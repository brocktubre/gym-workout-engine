import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, LogIn, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLogo } from '@/components/brand/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { SESSION_EXPIRED_MESSAGE_KEY } from '@/lib/auth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const locationState    = (location.state as { returnUrl?: string; restoredWorkout?: unknown } | null);
  const returnUrl        = locationState?.returnUrl ?? '/';
  const restoredWorkout  = locationState?.restoredWorkout;

  useEffect(() => {
    const message = sessionStorage.getItem(SESSION_EXPIRED_MESSAGE_KEY);
    if (!message) return;
    sessionStorage.removeItem(SESSION_EXPIRED_MESSAGE_KEY);
    setSessionNotice(message);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSessionNotice(null);
    setIsLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      navigate(returnUrl, { replace: true, state: restoredWorkout ? { restoredWorkout } : undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <AppLogo size="xl" wordmark />
          <p className="text-sm text-[#8E8E93] mt-1">How would you like to continue?</p>
        </div>

        {sessionNotice && (
          <div className="mb-4 text-sm text-[#FF9F0A] bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 rounded-xl px-3 py-2.5">
            {sessionNotice}
          </div>
        )}

        {/* ── Two choice cards ─────────────────────────────────────── */}
        <div className="space-y-3 mb-8">
          {/* Card 1 — Returning user / Sign In */}
          <div className="bg-[#1c1c1e] border border-[#38383A] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#FF375F]/20 flex items-center justify-center flex-shrink-0">
                <LogIn className="h-5 w-5 text-[#FF375F]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Returning User</p>
                <p className="text-xs text-[#8E8E93]">Sign in to access your workouts &amp; history</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />

              {error && (
                <div className="text-xs text-red-400 bg-red-600/10 border border-red-600/30 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Signing in…</>
                ) : (
                  <><LogIn className="h-4 w-4 mr-2" />Sign In</>
                )}
              </Button>

              <div className="flex justify-between text-xs pt-1">
                <Link to="/forgot-password" className="text-[#8E8E93] hover:text-white transition-colors">
                  Forgot password?
                </Link>
                <Link to="/register" className="text-[#FF375F] font-semibold hover:underline">
                  Create account
                </Link>
              </div>
            </form>
          </div>

          {/* Card 2 — Guest / Try without account */}
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="w-full bg-[#1c1c1e] border border-[#38383A] rounded-2xl p-5 text-left hover:border-[#FF375F]/40 hover:bg-[#2c2c2e] active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#0A84FF]/20 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-[#0A84FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Try as Guest</p>
                <p className="text-xs text-[#8E8E93]">Use the Workout Generator — no account needed</p>
              </div>
              <span className="text-[#8E8E93] text-lg flex-shrink-0">›</span>
            </div>
          </button>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 text-xs text-[#636366]">
          <Link to="/privacy" className="hover:text-[#8E8E93]">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-[#8E8E93]">Terms</Link>
        </div>
      </motion.div>
    </div>
  );
}
