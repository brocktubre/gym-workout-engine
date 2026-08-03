import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Target, BarChart2, Clock, RefreshCw } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWeightHanging, faArrowTrendUp, faPersonRunning, faFire,
  faDumbbell, faPersonWalking, faCog, faLink, faRing,
  faBell, faMinus, faSeedling, faBolt, faRocket,
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

const EQUIPMENT_OPTIONS: { value: Equipment; label: string; icon: React.ReactNode }[] = [
  { value: 'barbell', label: 'Barbell', icon: <FontAwesomeIcon icon={faWeightHanging} /> },
  { value: 'dumbbell', label: 'Dumbbell', icon: <FontAwesomeIcon icon={faDumbbell} /> },
  { value: 'bodyweight', label: 'Bodyweight', icon: <FontAwesomeIcon icon={faPersonWalking} /> },
  { value: 'machine', label: 'Machine', icon: <FontAwesomeIcon icon={faCog} /> },
  { value: 'cable', label: 'Cable', icon: <FontAwesomeIcon icon={faLink} /> },
  { value: 'resistance-band', label: 'Resistance Band', icon: <FontAwesomeIcon icon={faRing} /> },
  { value: 'kettlebell', label: 'Kettlebell', icon: <FontAwesomeIcon icon={faBell} /> },
  { value: 'ez-bar', label: 'EZ Bar', icon: <FontAwesomeIcon icon={faMinus} /> },
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
  availableEquipment: ['barbell', 'dumbbell', 'bodyweight'],
  goal: 'hypertrophy',
  fitnessLevel: 'intermediate',
  defaultDurationMinutes: 60,
  restBetweenSetsSeconds: 90,
  fatigueWindowHours: 48,
  exerciseVarietyDays: 7,
  preferCompound: true,
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
  const { data: serverSettings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (serverSettings) {
      setForm(serverSettings);
      setIsDirty(false);
    }
  }, [serverSettings]);

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
      await updateMutation.mutateAsync(form);
      setIsDirty(false);
      toast({ title: 'Settings saved!', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save settings',
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
        {/* Equipment */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4"
        >
          <SectionHeader icon={<FontAwesomeIcon icon={faDumbbell} />} title="Available Equipment" />
          <div className="grid grid-cols-2 gap-2">
            {EQUIPMENT_OPTIONS.map((eq) => {
              const selected = form.availableEquipment.includes(eq.value);
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
            value={[form.restBetweenSetsSeconds]}
            onValueChange={([v]) => v !== undefined && update('restBetweenSetsSeconds', v)}
            min={30}
            max={300}
            step={15}
          />
          <div className="flex justify-between text-xs text-[#8E8E93] mt-2">
            <span>30s</span>
            <span>5:00</span>
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

        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
      </div>
    </div>
  );
}
