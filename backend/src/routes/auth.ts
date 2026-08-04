/**
 * /api/auth — backend-assisted Cognito auth routes.
 *
 * Why a backend route instead of direct Cognito SDK calls from the frontend?
 * Cognito's public SignUp API creates users in UNCONFIRMED state, requiring
 * email verification before login. Since we want zero-friction signup (no
 * verification email), we use adminCreateUser + adminSetUserPassword which
 * creates a CONFIRMED user immediately.
 */
import { Router, Request, Response } from 'express';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  MessageActionType,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';

const router = Router();

const REGION          = process.env.COGNITO_REGION        || 'us-east-1';
const USER_POOL_ID    = process.env.COGNITO_USER_POOL_ID  || 'us-east-1_WucFi2sNK';
const CLIENT_ID       = process.env.COGNITO_CLIENT_ID     || '3i724l9g6bb4qffde95n7u5sgm';

const cognito = new CognitoIdentityProviderClient({ region: REGION });

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Creates a CONFIRMED Cognito user without email verification, then signs in.
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as { email?: string; password?: string; displayName?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    // 1. Create user — SUPPRESS prevents Cognito sending a welcome/verification email
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      MessageAction: MessageActionType.SUPPRESS,
      UserAttributes: [
        { Name: 'email',          Value: email  },
        { Name: 'email_verified', Value: 'true' },
      ],
      TemporaryPassword: password,
    }));

    // 2. Set a permanent password — moves user from FORCE_CHANGE_PASSWORD → CONFIRMED
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    }));

    // 3. Sign in and return tokens
    const authResult = await adminSignIn(email, password);

    // 4. Create user profile in DynamoDB with displayName
    if (authResult.idToken) {
      try {
        const { getOrCreateUserProfile } = await import('../services/userService');
        // Decode sub from the ID token payload (base64)
        const payload = JSON.parse(Buffer.from(authResult.idToken.split('.')[1], 'base64url').toString());
        const sub = payload.sub as string;
        if (sub) {
          await getOrCreateUserProfile(sub, email, displayName);
        }
      } catch (profileErr) {
        console.error('[auth/register] profile creation failed (non-fatal):', profileErr);
      }
    }

    res.json(authResult);
  } catch (err: any) {
    const code = err.name ?? err.__type ?? '';
    if (code === 'UsernameExistsException') {
      res.status(409).json({ error: 'UsernameExistsException', message: 'An account with this email already exists' });
      return;
    }
    if (code === 'InvalidPasswordException' || code === 'InvalidParameterException') {
      res.status(400).json({ error: code, message: 'Password must be at least 8 characters with uppercase, lowercase, and number' });
      return;
    }
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'RegistrationFailed', message: 'Could not create account. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Admin-initiated auth — works for confirmed users.
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  try {
    const result = await adminSignIn(email, password);
    res.json(result);
  } catch (err: any) {
    const code = err.name ?? err.__type ?? '';
    if (code === 'NotAuthorizedException' || code === 'UserNotFoundException') {
      res.status(401).json({ error: code, message: 'Incorrect email or password' });
      return;
    }
    if (code === 'UserNotConfirmedException') {
      res.status(403).json({ error: code, message: 'Account not confirmed. Please contact support.' });
      return;
    }
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'LoginFailed', message: 'Could not sign in. Please try again.' });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
async function adminSignIn(email: string, password: string) {
  const resp = await cognito.send(new AdminInitiateAuthCommand({
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID,
    AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  }));

  if (resp.ChallengeName) {
    // Handle NEW_PASSWORD_REQUIRED challenge (shouldn't happen with permanent passwords)
    if (resp.ChallengeName === 'NEW_PASSWORD_REQUIRED' && resp.Session) {
      const challengeResp = await cognito.send(new AdminRespondToAuthChallengeCommand({
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: resp.Session,
        ChallengeResponses: { USERNAME: email, NEW_PASSWORD: password },
      }));
      return extractTokens(challengeResp.AuthenticationResult);
    }
    throw new Error(`Unexpected challenge: ${resp.ChallengeName}`);
  }

  return extractTokens(resp.AuthenticationResult);
}

function extractTokens(result?: {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
} | null) {
  if (!result?.AccessToken || !result?.IdToken) {
    throw new Error('No tokens in authentication result');
  }
  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken ?? '',
    expiresIn: result.ExpiresIn ?? 3600,
  };
}

export default router;
