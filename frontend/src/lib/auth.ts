import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoRefreshToken,
} from 'amazon-cognito-identity-js';
import { getApiBaseUrl } from '@/lib/apiBase';

const COGNITO_USER_POOL_ID = 'us-east-1_WucFi2sNK';
const COGNITO_CLIENT_ID = '3i724l9g6bb4qffde95n7u5sgm';

const ACCESS_TOKEN_KEY = 'gym_access_token';
const ID_TOKEN_KEY = 'gym_id_token';
const REFRESH_TOKEN_KEY = 'gym_refresh_token';
const EMAIL_KEY = 'gym_user_email';

/** Shown on the login screen after a forced logout from token expiry. */
export const SESSION_EXPIRED_MESSAGE_KEY = 'gym_session_expired_message';
export const SESSION_EXPIRED_EVENT = 'gym:session-expired';
export const DEFAULT_SESSION_EXPIRED_MESSAGE =
  "You've been logged out because your session expired. Please sign in again.";

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
});

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface AuthUser {
  email: string;
  sub?: string;
  displayName?: string;
}

function persistTokens(session: CognitoUserSession, email?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.getAccessToken().getJwtToken());
  localStorage.setItem(ID_TOKEN_KEY, session.getIdToken().getJwtToken());
  localStorage.setItem(REFRESH_TOKEN_KEY, session.getRefreshToken().getToken());
  if (email) localStorage.setItem(EMAIL_KEY, email);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  // Clear user-specific data so it doesn't bleed to the next account
  localStorage.removeItem('gym_display_name');
}

/** Decode JWT payload without verifying — used only for local expiry checks. */
export function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, invalid, or expires within `skewSeconds`. */
export function isTokenExpiringSoon(
  token: string | null | undefined,
  skewSeconds = 120,
): boolean {
  const expMs = getTokenExpiryMs(token);
  if (expMs == null) return true;
  return expMs <= Date.now() + skewSeconds * 1000;
}

export function notifySessionExpired(
  message: string = DEFAULT_SESSION_EXPIRED_MESSAGE,
): void {
  sessionStorage.setItem(SESSION_EXPIRED_MESSAGE_KEY, message);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export const authService = {
  signIn(email: string, password: string): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          persistTokens(session, email);
          resolve({
            accessToken: session.getAccessToken().getJwtToken(),
            idToken: session.getIdToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
          });
        },
        onFailure: (err) => reject(err),
      });
    });
  },

  async signUp(email: string, password: string, displayName?: string): Promise<AuthTokens> {
    // Use backend route: adminCreateUser + adminSetUserPassword → no email verification required
    const resp = await fetch(`${getApiBaseUrl()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { error?: string };
      const err = new Error(body.error ?? 'Registration failed');
      (err as any).code = body.error ?? '';
      throw err;
    }
    const tokens = await resp.json() as { accessToken: string; idToken: string; refreshToken: string };
    localStorage.setItem('gym_access_token', tokens.accessToken);
    localStorage.setItem('gym_id_token', tokens.idToken);
    localStorage.setItem('gym_refresh_token', tokens.refreshToken);
    localStorage.setItem('gym_user_email', email);
    if (displayName) localStorage.setItem('gym_display_name', displayName);
    return tokens;
  },

  signOut(): void {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) currentUser.signOut();
    clearTokens();
    // Clear active workout state so the next user never inherits it from localStorage
    localStorage.removeItem('gym_active_workout');
    localStorage.removeItem('gym_paused_at');
    localStorage.removeItem('gym_turn_index');
    localStorage.removeItem('gym_timer_start');   // legacy
    localStorage.removeItem('gym_elapsed_offset'); // legacy
  },

  forgotPassword(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      cognitoUser.forgotPassword({
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
      });
    });
  },

  confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
      });
    });
  },

  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) return reject(new Error('Not signed in'));
      cognitoUser.getSession((err: Error | null) => {
        if (err) return reject(err);
        cognitoUser.changePassword(oldPassword, newPassword, (changeErr) => {
          if (changeErr) return reject(changeErr);
          resolve();
        });
      });
    });
  },

  getCurrentUser(): CognitoUser | null {
    return userPool.getCurrentUser();
  },

  getCurrentEmail(): string | null {
    return localStorage.getItem(EMAIL_KEY);
  },

  getCurrentDisplayName(): string | null {
    return localStorage.getItem('gym_display_name');
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getIdToken(): string | null {
    return localStorage.getItem(ID_TOKEN_KEY);
  },

  /** Restore session from stored tokens (validates against Cognito silently). */
  restoreSession(): Promise<AuthTokens | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        clearTokens();
        return resolve(null);
      }
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          // Try refresh
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (!refreshToken) {
            clearTokens();
            return resolve(null);
          }
          return authService
            .refreshSession()
            .then(resolve)
            .catch(() => {
              clearTokens();
              resolve(null);
            });
        }
        persistTokens(session);
        resolve({
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        });
      });
    });
  },

  refreshSession(): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
      const email = localStorage.getItem(EMAIL_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      const cognitoUser =
        userPool.getCurrentUser()
        ?? (email ? new CognitoUser({ Username: email, Pool: userPool }) : null);

      if (!cognitoUser) return reject(new Error('No current user'));

      const refreshWithToken = (refreshToken: CognitoRefreshToken) => {
        cognitoUser.refreshSession(refreshToken, (refreshErr, newSession: CognitoUserSession) => {
          if (refreshErr) return reject(refreshErr);
          persistTokens(newSession, email ?? undefined);
          resolve({
            accessToken: newSession.getAccessToken().getJwtToken(),
            idToken: newSession.getIdToken().getJwtToken(),
            refreshToken: newSession.getRefreshToken().getToken(),
          });
        });
      };

      const refreshFromStorage = () => {
        if (!storedRefresh) return reject(new Error('No refresh token'));
        refreshWithToken(new CognitoRefreshToken({ RefreshToken: storedRefresh }));
      };

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          refreshFromStorage();
          return;
        }
        cognitoUser.refreshSession(session.getRefreshToken(), (refreshErr, newSession: CognitoUserSession) => {
          if (refreshErr) {
            refreshFromStorage();
            return;
          }
          persistTokens(newSession, email ?? undefined);
          resolve({
            accessToken: newSession.getAccessToken().getJwtToken(),
            idToken: newSession.getIdToken().getJwtToken(),
            refreshToken: newSession.getRefreshToken().getToken(),
          });
        });
      });
    });
  },
};

/** Map raw Cognito error codes to user-friendly messages. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string; name?: string })?.code
    ?? (err as { name?: string })?.name
    ?? '';
  switch (code) {
    case 'UserNotFoundException':
      return 'No account found with that email';
    case 'NotAuthorizedException':
      return 'Incorrect email or password';
    case 'UsernameExistsException':
      return 'An account with this email already exists';
    case 'InvalidPasswordException':
    case 'InvalidParameterException':
      return 'Password must be at least 8 characters with uppercase, lowercase, and number';
    case 'CodeMismatchException':
      return 'Invalid verification code';
    case 'ExpiredCodeException':
      return 'Code has expired. Please request a new one';
    case 'LimitExceededException':
      return 'Too many attempts. Please try again later';
    default:
      return 'Something went wrong. Please try again';
  }
}
