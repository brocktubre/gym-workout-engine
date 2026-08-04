import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { authService, friendlyAuthError, type AuthUser } from '@/lib/auth';
import { api } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => void;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const setUserFromEmail = (email: string, displayName?: string) => {
    setUser({ email, displayName: displayName ?? authService.getCurrentDisplayName() ?? undefined });
  };

  /** Fetch this user's profile from the backend and update displayName in state + localStorage.
   *  Always call after sign-in to ensure we show the correct user's name, not a stale localStorage value. */
  const syncProfileFromBackend = useCallback(async (email: string) => {
    try {
      const settings = await api.getSettings();
      const dn = (settings as unknown as { displayName?: string }).displayName;
      if (dn) {
        localStorage.setItem('gym_display_name', dn);
        setUser(prev => prev ? { ...prev, displayName: dn } : { email, displayName: dn });
      }
    } catch {
      // Non-fatal — user object already set, just won't have displayName until next load
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = useCallback(() => {
    clearRefreshTimer();
    authService.signOut();
    setUser(null);
    // Redirect to login using hash router
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    clearRefreshTimer();
    refreshTimerRef.current = setInterval(async () => {
      try {
        await authService.refreshSession();
      } catch {
        handleSignOut();
      }
    }, REFRESH_INTERVAL_MS);
  }, [handleSignOut]);

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = await authService.restoreSession();
        if (cancelled) return;
        if (tokens) {
          const email = authService.getCurrentEmail() ?? '';
          setUserFromEmail(email, authService.getCurrentDisplayName() ?? undefined);
          startRefreshTimer();
          // Sync real displayName from backend in background (fixes stale localStorage on account switch)
          void syncProfileFromBackend(email);
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
  }, [startRefreshTimer]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        await authService.signIn(email, password);
        // Set user immediately, then fetch the real profile for this specific account
        setUserFromEmail(email);
        startRefreshTimer();
        void syncProfileFromBackend(email);
      } catch (err) {
        throw new Error(friendlyAuthError(err));
      }
    },
    [startRefreshTimer, syncProfileFromBackend],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      try {
        await authService.signUp(email, password, displayName);
        setUserFromEmail(email, displayName);
        startRefreshTimer();
      } catch (err) {
        throw new Error(friendlyAuthError(err));
      }
    },
    [startRefreshTimer],
  );

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await authService.forgotPassword(email);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const confirmForgotPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      try {
        await authService.confirmForgotPassword(email, code, newPassword);
      } catch (err) {
        throw new Error(friendlyAuthError(err));
      }
    },
    [],
  );

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    try {
      await authService.changePassword(oldPassword, newPassword);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signIn,
    signUp,
    signOut: handleSignOut,
    forgotPassword,
    confirmForgotPassword,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
