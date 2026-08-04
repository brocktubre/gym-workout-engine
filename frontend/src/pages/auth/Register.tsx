import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dumbbell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredWorkout = (location.state as { restoredWorkout?: unknown } | null)?.restoredWorkout;
  const { signUp } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const displayName = `${firstName.trim()} ${lastName.trim()}`;
    setIsLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, displayName);
      if (restoredWorkout) {
        // Send user back to Generate with their previously generated workout
        navigate('/generate', { replace: true, state: { restoredWorkout } });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
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
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-sm text-[#8E8E93] mt-1">Start tracking your workouts</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                First Name
              </label>
              <Input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Brock"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                Last Name
              </label>
              <Input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tubre"
                required
              />
            </div>
          </div>

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
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <p className="text-xs text-[#636366] mt-1.5">
              8+ characters with uppercase, lowercase, and a number
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#8E8E93]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#FF375F] font-semibold hover:underline">
            Sign In
          </Link>
        </p>

        <p className="mt-8 text-center text-xs text-[#636366]">
          By creating an account, you agree to our{' '}
          <Link to="/terms" className="text-[#8E8E93] hover:underline">Terms</Link>
          {' and '}
          <Link to="/privacy" className="text-[#8E8E93] hover:underline">Privacy Policy</Link>.
        </p>
      </motion.div>
    </div>
  );
}
