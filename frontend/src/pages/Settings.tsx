import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Target, BarChart2, Clock, RefreshCw, User, LogOut, KeyRound, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWeightHanging, faArrowTrendUp, faPersonRunning, faFire,
  faDumbbell, faPersonWalking, faLink, faRing,
  faBell, faMinus, faSeedling, faBolt, faRocket,
  faArrowUp, faWater, faTruckFast, faCube,
  faShirt, faBagShopping, faCircleDot, faPersonBiking,
  faPersonSwimming, faPersonSkiing, faCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { toast } from '@/components/ui/use-toast';
import { cn, formatElapsedTime } from '@/lib/utils';
import type { Equipment, WorkoutGoal, Difficulty, UserSettings } from '@/types';

const EQUIPMENT_OPTIONS: { value: Equipment; label: string; icon: React.ReactNode; category: string }[] = [
  // Free Weights
  { value: 'barbell', label: 'Barbell', icon: <FontAwesomeIcon icon={faWeightHanging} />, category: 'Free Weights' },
  { value: 'dumbbell', label: 'Dumbbells', icon: <FontAwesomeIcon icon={faDumbbell} />, category: 'Free Weights' },
  { value: 'kettlebell', label: 'Kettlebells', icon: <FontAwesomeIcon icon={faBell} />, category: 'Free Weights' },
  { value: 'plate', label: 'Weight Plate', icon: <FontAwesomeIcon icon={faCircle} />, category: 'Free Weights' },
  // Bodyweight
  { value: 'bodyweight', label: 'Bodyweight', icon: <FontAwesomeIcon icon={faPersonWalking} />, category: 'Bodyweight' },
  { value: 'rings', label: 'Gymnastics Rings', icon: <FontAwesomeIcon icon={faRing} />, category: 'Bodyweight' },
  { value: 'pull-up-bar', label: 'Pull-Up Bar', icon: <FontAwesomeIcon icon={faArrowUp} />, category: 'Bodyweight' },
  // Functional

  { value: 'battle-rope', label: 'Battle Rope', icon: <FontAwesomeIcon icon={faWater} />, category: 'Functional' },
  { value: 'sled', label: 'Sled', icon: <FontAwesomeIcon icon={faTruckFast} />, category: 'Functional' },
  { value: 'plyometric-box', label: 'Plyo Box', icon: <FontAwesomeIcon icon={faCube} />, category: 'Functional' },
  { value: 'weight-vest', label: 'Weight Vest', icon: <FontAwesomeIcon icon={faShirt} />, category: 'Functional' },
  { value: 'sandbag', label: 'Sandbag', icon: <FontAwesomeIcon icon={faBagShopping} />, category: 'Functional' },
  { value: 'medicine-ball', label: 'Med Ball', icon: <FontAwesomeIcon icon={faCircleDot} />, category: 'Functional' },
  // Cardio
  { value: 'echo-bike', label: 'Echo Bike', icon: <FontAwesomeIcon icon={faPersonBiking} />, category: 'Cardio' },
  { value: 'rower', label: 'Row Erg', icon: <FontAwesomeIcon icon={faPersonSwimming} />, category: 'Cardio' },
  { value: 'ski-erg', label: 'Ski Erg', icon: <FontAwesomeIcon icon={faPersonSkiing} />, category: 'Cardio' },
  // Other
  { value: 'cable', label: 'Cable', icon: <FontAwesomeIcon icon={faLink} />, category: 'Other' },
  { value: 'resistance-band', label: 'Bands', icon: <FontAwesomeIcon icon={faMinus} />, category: 'Other' },
  { value: 'hip-circle-band', label: 'Hip Circle Bands', icon: <FontAwesomeIcon icon={faMinus} />, category: 'Other' },
  { value: 'ez-bar', label: 'EZ Bar', icon: <FontAwesomeIcon icon={faMinus} />, category: 'Other' },
];

const GOAL_OPTIONS: { value: WorkoutGoal; label: string; icon: React.ReactNode }[] = [
  { value: 'strength', label: 'Strength', icon: <FontAwesomeIcon icon={faWeightHanging} /> },
  { value: 'hypertrophy', label: 'Hypertrophy', icon: <FontAwesomeIcon icon={faArrowTrendUp} /> },
  { value: 'endurance', label: 'Endurance', icon: <FontAwesomeIcon icon={faPersonRunning} /> },
  { value: 'fat-loss', label: 'Fat Loss', icon: <FontAwesomeIcon icon={faFire} /> },
];

const LEVEL_OPTIONS: { value: Difficulty; label: string; icon: React.ReactNode }[] = [
  { value: 'beginner', label: 'Beginner', icon: <FontAwesomeIcon icon={faSeedling} /> },
  { value: 'intermediate', label: 'Intermediate', icon: <FontAwesomeIcon icon={faBolt} /> },
  { value: 'advanced', label: 'Advanced', icon: <FontAwesomeIcon icon={faRocket} /> },
];

const DURATION_OPTIONS = [30, 45, 60, 90];

// Default settings if API returns nothing yet
const DEFAULT_SETTINGS: UserSettings = {
  availableEquipment: [
    'barbell', 'dumbbell', 'kettlebell', 'bodyweight',
    'rings', 'pull-up-bar', 'resistance-band',
    'battle-rope', 'sled', 'plyometric-box', 'weight-vest',
    'sandbag', 'medicine-ball', 'echo-bike', 'rower', 'ski-erg',
    'plate',
  ],
  goal: 'hypertrophy',
  fitnessLevel: 'intermediate',
  defaultDurationMinutes: 60,
  restBetweenSetsSeconds: 90,
  // Note: hip-circle-band is listed separately; users opt-in via equipment selection
  fatigueWindowHours: 48,
  exerciseVarietyDays: 7,
  preferCompound: true,
  includeWarmup: true,
  allowSupersets: true,
};

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-6 w-6 text-[#FF375F]">{icon}</div>
      <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { data: serverSettings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const { user, isAuthenticated, signOut, changePassword } = useAuth();

  const [form, setForm] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
      toast({ title: 'Password updated', variant: 'success' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Change failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (serverSettings) {
      // Merge with defaults so missing fields (new additions) don't cause crashes
      setForm({ ...DEFAULT_SETTINGS, ...serverSettings,
        availableEquipment: serverSettings.availableEquipment?.length
          ? serverSettings.availableEquipment
          : DEFAULT_SETTINGS.availableEquipment,
      });
      const rawDisplayName = (serverSettings as unknown as { displayName?: string }).displayName;
      setDisplayName(rawDisplayName ?? '');
      setIsDirty(false);
    }
  }, [serverSettings]);

  useEffect(() => {
    // Default displayName to email prefix when user first signs in
    if (isAuthenticated && user?.email && !displayName) {
      setDisplayName(user.email.split('@')[0] ?? '');
    }
  }, [isAuthenticated, user, displayName]);

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  const toggleEquipment = (eq: Equipment) => {
    const current = form.availableEquipment;
    const next = current.includes(eq) ? current.filter((e) => e !== eq) : [...current, eq];
    update('availableEquipment', next);
  };

  const handleSave = async () => {
    try {
      // Strip any undefined values before sending
      const payload = JSON.parse(JSON.stringify(form)) as UserSettings & { displayName?: string };
      if (isAuthenticated && displayName.trim()) {
        payload.displayName = displayName.trim();
      }
      await updateMutation.mutateAsync(payload);
      setIsDirty(false);
      toast({ title: 'Settings saved!', variant: 'success' });
    } catch (err) {
      console.error('[Settings] Save error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Save failed',
        description: msg.includes('fetch') ? 'Network error — check your connection and try again' : msg,
        variant: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <PageHeader title="Settings" />
        <div className="px-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader
        title="Settings"
        subtitle="Customize your training"
        action={
          isDirty && (
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          )
        }
      />

      <div className="px-4 space-y-6 pb-8">
        {/* Account */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <SectionHeader icon={<User className="h-full w-full" />} title="Account" />
          {isAuthenticated && user ? (
            <div className="space-y-3">
              {/* Name fields — read-only (set at registration) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                    First Name
                  </label>
                  <div className="text-sm text-white bg-[#2c2c2e] border border-[#38383A] rounded-xl px-3 py-2.5">
                    {user.displayName?.split(' ')[0] ?? '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                    Last Name
                  </label>
                  <div className="text-sm text-white bg-[#2c2c2e] border border-[#38383A] rounded-xl px-3 py-2.5">
                    {user.displayName?.split(' ').slice(1).join(' ') || '—'}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="text-sm text-white bg-[#2c2c2e] border border-[#38383A] rounded-xl px-3 py-2.5">
                  {user.email}
                </div>
              </div>

              {!showChangePassword ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowChangePassword(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-1.5" />
                    Change Password
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4 mr-1.5" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                  {passwordError && (
                    <div className="text-sm text-red-400 bg-red-600/10 border border-red-600/30 rounded-xl px-3 py-2">
                      {passwordError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setShowChangePassword(false);
                        setPasswordError(null);
                        setOldPassword('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="flex-1" disabled={passwordLoading}>
                      {passwordLoading ? (
                        <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1.5" />
                      )}
                      Save
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => navigate('/register')}
              >
                Create Account
              </Button>
            </div>
          )}
        </motion.section>

        <Separator className="bg-[#38383A]" />

        {/* Equipment */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <SectionHeader icon={<FontAwesomeIcon icon={faDumbbell} />} title="Available Equipment" />
          {(['Free Weights', 'Bodyweight', 'Functional', 'Cardio', 'Other'] as const).map((cat) => {
            const catItems = EQUIPMENT_OPTIONS.filter((eq) => eq.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold text-[#636366] uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-2 gap-2">
                  {catItems.map((eq) => {
                    const selected = (form.availableEquipment ?? []).includes(eq.value);
                    return (
                      <button
                        key={eq.value}
                        onClick={() => toggleEquipment(eq.value)}
                        className={cn(
                          'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors border text-left',
                          selected
                            ? 'bg-[#FF375F]/15 text-[#FF375F] border-[#FF375F]/30'
                            : 'bg-[#2c2c2e] text-[#8E8E93] border-[#38383A]',
                        )}
                      >
                        <span className="w-4 text-center flex-shrink-0">{eq.icon}</span>
                        {eq.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.section>

        <Separator className="bg-[#38383A]" />

        {/* Goal */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <SectionHeader icon={<Target className="h-full w-full" />} title="Primary Goal" />
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.value}
                onClick={() => update('goal', g.value)}
                className={cn(
                  'flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors border text-left',
                  form.goal === g.value
                    ? 'bg-[#FF375F]/15 text-[#FF375F] border-[#FF375F]/30'
                    : 'bg-[#2c2c2e] text-[#8E8E93] border-[#38383A]',
                )}
              >
                <span className="w-4 text-center flex-shrink-0">{g.icon}</span>
                {g.label}
              </button>
            ))}
          </div>
        </motion.section>

        <Separator className="bg-[#38383A]" />

        {/* Fitness Level */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <SectionHeader icon={<BarChart2 className="h-full w-full" />} title="Fitness Level" />
          <div className="flex gap-2">
            {LEVEL_OPTIONS.map((lv) => (
              <button
                key={lv.value}
                onClick={() => update('fitnessLevel', lv.value)}
                className={cn(
                  'flex-1 flex flex-col items-center py-2.5 px-2 rounded-xl text-xs font-medium transition-colors border gap-1',
                  form.fitnessLevel === lv.value
                    ? 'bg-[#FF375F]/15 text-[#FF375F] border-[#FF375F]/30'
                    : 'bg-[#2c2c2e] text-[#8E8E93] border-[#38383A]',
                )}
              >
                <span className="text-base">{lv.icon}</span>
                {lv.label}
              </button>
            ))}
          </div>
        </motion.section>

        <Separator className="bg-[#38383A]" />

        {/* Default Duration */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <SectionHeader icon={<Clock className="h-full w-full" />} title="Default Duration" />
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => update('defaultDurationMinutes', d)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border',
                  form.defaultDurationMinutes === d
                    ? 'bg-[#FF375F] text-white border-[#FF375F]'
                    : 'bg-[#2c2c2e] text-[#8E8E93] border-[#38383A]',
                )}
              >
                {d}m
              </button>
            ))}
          </div>
        </motion.section>

        <Separator className="bg-[#38383A]" />

        {/* Rest Time */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">Rest Between Sets</h3>
            </div>
            <span className="text-[#FF375F] font-bold text-lg">
              {formatElapsedTime(form.restBetweenSetsSeconds)}
            </span>
          </div>
          <Slider
            value={[Math.min(90, Math.max(5, form.restBetweenSetsSeconds))]}
            onValueChange={([v]) => v !== undefined && update('restBetweenSetsSeconds', v)}
            min={5}
            max={90}
            step={5}
          />
          <div className="flex justify-between text-xs text-[#8E8E93] mt-2">
            <span>5s</span>
            <span>90s</span>
          </div>
        </motion.section>

        {/* Fatigue Window */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">Fatigue Window</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">Avoid muscles trained recently</p>
            </div>
            <span className="text-[#FF375F] font-bold text-lg">
              {form.fatigueWindowHours}h
            </span>
          </div>
          <Slider
            value={[form.fatigueWindowHours]}
            onValueChange={([v]) => v !== undefined && update('fatigueWindowHours', v)}
            min={24}
            max={96}
            step={12}
          />
          <div className="flex justify-between text-xs text-[#8E8E93] mt-2">
            <span>24h</span>
            <span>96h</span>
          </div>
        </motion.section>

        {/* Exercise Variety */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">Exercise Variety</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">Avoid repeating exercises within N days</p>
            </div>
            <span className="text-[#FF375F] font-bold text-lg">
              {form.exerciseVarietyDays}d
            </span>
          </div>
          <Slider
            value={[form.exerciseVarietyDays]}
            onValueChange={([v]) => v !== undefined && update('exerciseVarietyDays', v)}
            min={3}
            max={14}
            step={1}
          />
          <div className="flex justify-between text-xs text-[#8E8E93] mt-2">
            <span>3 days</span>
            <span>14 days</span>
          </div>
        </motion.section>

        {/* Prefer Compound */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Prefer Compound Exercises</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">Prioritize multi-joint movements</p>
            </div>
            <Switch
              checked={form.preferCompound}
              onCheckedChange={(v) => update('preferCompound', v)}
            />
          </div>
        </motion.section>

        {/* Include Warmup */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Include Warmup</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">5-10 min cardio + muscle-specific stretching before workouts</p>
            </div>
            <Switch
              checked={form.includeWarmup ?? true}
              onCheckedChange={(v) => update('includeWarmup', v)}
            />
          </div>
        </motion.section>

        {/* Allow Supersets */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Allow Supersets</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">Pair antagonist muscle groups for time-efficient training</p>
            </div>
            <Switch
              checked={form.allowSupersets ?? true}
              onCheckedChange={(v) => update('allowSupersets', v)}
            />
          </div>
        </motion.section>

        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
        >
          <Button
            size="lg"
            className="w-full"
            onClick={handleSave}
            disabled={updateMutation.isPending || !isDirty}
          >
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </motion.div>

        {/* Legal + version footer */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="pt-4 space-y-1"
        >
          <button
            onClick={() => navigate('/privacy')}
            className="w-full flex items-center justify-between py-3 px-4 bg-[#1c1c1e] rounded-2xl border border-[#38383A] text-left"
          >
            <span className="text-sm text-white">Privacy Policy</span>
            <ChevronRight className="h-4 w-4 text-[#8E8E93]" />
          </button>
          <button
            onClick={() => navigate('/terms')}
            className="w-full flex items-center justify-between py-3 px-4 bg-[#1c1c1e] rounded-2xl border border-[#38383A] text-left"
          >
            <span className="text-sm text-white">Terms of Service</span>
            <ChevronRight className="h-4 w-4 text-[#8E8E93]" />
          </button>
          <p className="text-center text-xs text-[#636366] pt-3">App Version: 1.0.0</p>
        </motion.section>
      </div>
    </div>
  );
}
