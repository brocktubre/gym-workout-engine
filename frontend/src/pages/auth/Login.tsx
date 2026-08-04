import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dumbbell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const locationState = (location.state as { returnUrl?: string; restoredWorkout?: unknown } | null);
  const returnUrl = locationState?.returnUrl ?? '/';
  const restoredWorkout = locationState?.restoredWorkout;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[#FF375F] flex items-center justify-center mb-4 shadow-lg shadow-[#FF375F]/30">
            <Dumbbell className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-sm text-[#8E8E93] mt-1">Sign in to continue training</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-600/10 border border-red-600/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <Link to="/forgot-password" className="text-[#FF375F] hover:underline">
            Forgot Password?
          </Link>
          <p className="text-[#8E8E93]">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#FF375F] font-semibold hover:underline">
              Create Account
            </Link>
          </p>
        </div>

        {/* Generate without signing in */}
        <div className="mt-6 text-center">
          <Link
            to="/generate"
            className="text-sm text-[#8E8E93] hover:text-white transition-colors"
          >
            Try generating a workout without an account →
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[#636366]">
          <Link to="/privacy" className="hover:text-[#8E8E93]">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-[#8E8E93]">Terms</Link>
        </div>
      </motion.div>
    </div>
  );
}
