import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLogo } from '@/components/brand/AppLogo';
import { useUpdateSettings, useSettings } from '@/hooks/useSettings';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  needsBodyOnboarding,
  getBodyMetricFieldErrors,
  sanitizeDigitInput,
  heightInchesFromParts,
  HEIGHT_FT_MAX_CHARS,
  HEIGHT_IN_MAX_CHARS,
  WEIGHT_MAX_CHARS,
} from '@/lib/bodyProfile';
import type { UserSettings } from '@/types';

/**
 * Shown once after account creation (and on later logins until dismissed)
 * so Claude can prescribe better starting loads.
 */
export default function BodyOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as {
    restoredWorkout?: unknown;
    returnUrl?: string;
  };
  const { data: existing, isFetched } = useSettings();
  const updateMutation = useUpdateSettings();

  const [sex, setSex] = useState<'male' | 'female' | undefined>(undefined);
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Prefill if the user partially saved earlier; bail if already dismissed
  useEffect(() => {
    if (!isFetched || hydrated) return;
    setHydrated(true);
    if (existing && !needsBodyOnboarding(existing)) {
      finish(locationState.restoredWorkout);
      return;
    }
    if (!existing) return;
    if (existing.sex) setSex(existing.sex);
    if (existing.heightInches) {
      setHeightFt(String(Math.floor(existing.heightInches / 12)));
      setHeightIn(String(existing.heightInches % 12));
    }
    if (existing.bodyWeightLbs) setWeightLbs(String(existing.bodyWeightLbs));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetched, existing, hydrated]);

  const fieldErrors = useMemo(
    () => getBodyMetricFieldErrors({ heightFt, heightIn, weightLbs }, { requireComplete: true }),
    [heightFt, heightIn, weightLbs],
  );
  const metricsInvalid = Boolean(fieldErrors.height || fieldErrors.weight);
  // Show field errors once the user has typed something or tried to continue
  const showFieldErrors = attempted || heightFt !== '' || heightIn !== '' || weightLbs !== '';

  const finish = (restoredWorkout?: unknown) => {
    if (restoredWorkout) {
      navigate('/generate', { replace: true, state: { restoredWorkout } });
      return;
    }
    const returnUrl = locationState.returnUrl ?? '/';
    navigate(returnUrl, { replace: true });
  };

  const persist = async (patch: Partial<UserSettings>) => {
    // Merge onto current settings so we don't wipe equipment / goal prefs
    const base = { ...(existing ?? {}) } as UserSettings;
    await updateMutation.mutateAsync({ ...base, ...patch });
  };

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttempted(true);

    if (!sex) {
      setError('Please select male or female');
      return;
    }
    if (metricsInvalid) return;

    const ft = parseInt(heightFt, 10);
    const inches = parseInt(heightIn, 10);
    const lbs = parseInt(weightLbs, 10);

    setSaving(true);
    try {
      await persist({
        sex,
        heightInches: heightInchesFromParts(ft, inches),
        bodyWeightLbs: lbs,
        bodyProfileDismissed: true,
      });
      toast({ title: 'Profile saved', variant: 'success', duration: 2000 });
      finish(locationState.restoredWorkout);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    setError(null);
    try {
      await persist({ bodyProfileDismissed: true });
      finish(locationState.restoredWorkout);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue');
      setSaving(false);
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
        <div className="flex flex-col items-center mb-8">
          <AppLogo size="xl" />
          <h1 className="text-2xl font-bold text-white text-center mt-3">Tell us about you</h1>
          <p className="text-sm text-[#8E8E93] mt-2 text-center leading-relaxed">
            Sex, height, and weight help us suggest better starting loads for your workouts
          </p>
        </div>

        <form onSubmit={handleContinue} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Sex
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'male' as const, label: 'Male' },
                { value: 'female' as const, label: 'Female' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSex(opt.value)}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-semibold border transition-colors',
                    sex === opt.value
                      ? 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/40'
                      : 'bg-[#2c2c2e] text-[#8E8E93] border-[#38383A] hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Height
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="5"
                  maxLength={HEIGHT_FT_MAX_CHARS}
                  className="bg-[#2c2c2e] border-[#38383A] text-white pr-8"
                  value={heightFt}
                  onChange={(e) => setHeightFt(sanitizeDigitInput(e.target.value, HEIGHT_FT_MAX_CHARS))}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93]">ft</span>
              </div>
              <div className="relative flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="10"
                  maxLength={HEIGHT_IN_MAX_CHARS}
                  className="bg-[#2c2c2e] border-[#38383A] text-white pr-8"
                  value={heightIn}
                  onChange={(e) => setHeightIn(sanitizeDigitInput(e.target.value, HEIGHT_IN_MAX_CHARS))}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93]">in</span>
              </div>
            </div>
            {showFieldErrors && fieldErrors.height && (
              <p className="text-xs text-red-400 mt-1.5">{fieldErrors.height}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
              Weight
            </label>
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="180"
                maxLength={WEIGHT_MAX_CHARS}
                className="bg-[#2c2c2e] border-[#38383A] text-white pr-10"
                value={weightLbs}
                onChange={(e) => setWeightLbs(sanitizeDigitInput(e.target.value, WEIGHT_MAX_CHARS))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93]">lbs</span>
            </div>
            {showFieldErrors && fieldErrors.weight && (
              <p className="text-xs text-red-400 mt-1.5">{fieldErrors.weight}</p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-600/10 border border-red-600/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={saving || !sex || metricsInvalid}
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="mt-4 w-full text-center text-sm text-[#8E8E93] hover:text-white transition-colors py-2 disabled:opacity-40"
        >
          Skip for now
        </button>
        <p className="mt-1 text-center text-xs text-[#636366]">
          You can edit this anytime in Settings
        </p>
      </motion.div>
    </div>
  );
}
