import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { needsBodyOnboarding } from '@/lib/bodyProfile';

/**
 * Redirects authenticated users who haven't completed/skipped the body profile
 * prompt to /onboarding/body. Mount inside protected app shell routes.
 */
export function BodyOnboardingGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: settings, isLoading: settingsLoading, isFetched } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!isFetched || settingsLoading) return;
    if (location.pathname === '/onboarding/body') return;
    // Don't interrupt an in-progress workout for this prompt
    if (location.pathname === '/active') return;
    if (!needsBodyOnboarding(settings)) return;

    navigate('/onboarding/body', {
      replace: true,
      state: {
        returnUrl: location.pathname + location.search + location.hash,
        ...(location.state && typeof location.state === 'object' ? location.state : {}),
      },
    });
  }, [
    authLoading,
    isAuthenticated,
    isFetched,
    settingsLoading,
    settings,
    location.pathname,
    location.search,
    location.hash,
    location.state,
    navigate,
  ]);

  return <>{children}</>;
}
