import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RefreshCw, Play, Clock, ChevronRight } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWeightHanging, faArrowTrendUp, faPersonRunning, faFire,
  faArrowRightArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseItem } from '@/components/workout/ExerciseItem';
import { SwapExerciseSheet } from '@/components/workout/SwapExerciseSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGenerateWorkout, useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { useCreateWorkout } from '@/hooks/useWorkouts';
import { useSettings } from '@/hooks/useSettings';
import { toast } from '@/components/ui/use-toast';
import { getTodayDate, formatDuration } from '@/lib/utils';
import type { MuscleGroup, WorkoutGoal, WorkoutExercise, WarmupItem, Exercise } from '@/types';
import { cn } from '@/lib/utils';

const DURATION_OPTIONS = [30, 45, 60, 90];

const GOAL_OPTIONS: { value: WorkoutGoal; label: string; icon: React.ReactNode }[] = [
  { value: 'strength', label: 'Strength', icon: <FontAwesomeIcon icon={faWeightHanging} /> },
  { value: 'hypertrophy', label: 'Hypertrophy', icon: <FontAwesomeIcon icon={faArrowTrendUp} /> },
  { value: 'endurance', label: 'Endurance', icon: <FontAwesomeIcon icon={faPersonRunning} /> },
  { value: 'fat-loss', label: 'Fat Loss', icon: <FontAwesomeIcon icon={faFire} /> },
];

const MUSCLE_OPTIONS: { value: MuscleGroup; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
];

interface GeneratedWorkout {
  id?: string;
  exercises: WorkoutExercise[];
  goal: WorkoutGoal;
  targetDurationMinutes: number;
  warmup?: WarmupItem[];
}

interface GenerateLocationState {
  suggestedMuscles?: MuscleGroup[];
  suggestedGoal?: WorkoutGoal;
}

export default function Generate() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as GenerateLocationState;
  const { data: settings } = useSettings();

  const [duration, setDuration] = useState(60);
  // Goal defaults: AI suggestion > saved settings > fallback 'hypertrophy'
  const [goal, setGoal] = useState<WorkoutGoal>(
    locationState.suggestedGoal ?? settings?.goal ?? 'hypertrophy',
  );
  const [targetMuscles, setTargetMuscles] = useState<MuscleGroup[]>(locationState.suggestedMuscles ?? []);
  const [includeWarmup, setIncludeWarmup] = useState(settings?.includeWarmup ?? true);
  const [allowSupersets, setAllowSupersets] = useState(settings?.allowSupersets ?? true);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [swapTarget, setSwapTarget] = useState<WorkoutExercise | null>(null);

  // Sync goal + toggles from settings once they load (only if user hasn't
  // already changed them and no AI suggestion was provided)
  const settingsSyncedRef = useRef(false);
  useEffect(() => {
    if (settingsSyncedRef.current || !settings) return;
    settingsSyncedRef.current = true;
    if (!locationState.suggestedGoal) setGoal(settings.goal);
    setIncludeWarmup(settings.includeWarmup ?? true);
    setAllowSupersets(settings.allowSupersets ?? true);
    if (settings.defaultDurationMinutes) setDuration(settings.defaultDurationMinutes);
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwap = (newExercise: Exercise) => {
    if (!swapTarget || !generatedWorkout) return;
    setGeneratedWorkout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map(we =>
          we.exerciseId === swapTarget.exerciseId
            ? {
                ...we,
                exerciseId: newExercise.id,
                exercise: newExercise,
                progressionNote: undefined,
                // Keep sets structure; clear weight for bodyweight swaps
                sets: we.sets.map(s => ({
                  ...s,
                  targetWeight: newExercise.category === 'cardio' ? undefined
                    : newExercise.equipment === 'bodyweight' || newExercise.equipment === 'rings'
                    ? undefined
                    : s.targetWeight,
                })),
              }
            : we,
        ),
      };
    });
  };

  const generateMutation = useGenerateWorkout();
  const createWorkoutMutation = useCreateWorkout();
  const { startWorkout, hasActiveWorkout, isPaused } = useActiveWorkout();

  const toggleMuscle = (muscle: MuscleGroup) => {
    setTargetMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  };

  const handleGenerate = async (excludeIds?: string[]) => {
    try {
      const result = await generateMutation.mutateAsync({
        durationMinutes: duration,
        goal,
        targetMuscleGroups: targetMuscles.length > 0 ? targetMuscles : undefined,
        includeWarmup,
        allowSupersets,
        excludeExerciseIds: excludeIds,
      });
      setGeneratedWorkout(result.workout);
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Could not generate workout',
        variant: 'error',
      });
    }
  };

  const handleStartWorkout = async () => {
    if (!generatedWorkout) return;

    try {
      const now = new Date().toISOString();
      const hasWarmup = (generatedWorkout.warmup?.length ?? 0) > 0;
      const workout = await createWorkoutMutation.mutateAsync({
        date: getTodayDate(),
        createdAt: now,
        status: 'in-progress',
        exercises: generatedWorkout.exercises,
        targetDurationMinutes: generatedWorkout.targetDurationMinutes,
        goal: generatedWorkout.goal,
        warmup: generatedWorkout.warmup,
        warmupStatus: hasWarmup ? 'pending' : 'skipped',
      });

      startWorkout(workout);
      navigate('/active');
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not start workout',
        variant: 'error',
      });
    }
  };

  // Calculate warmup total minutes for preview
  const totalWarmupMinutes = generatedWorkout?.warmup
    ? Math.round(generatedWorkout.warmup.reduce((acc, item) => acc + item.durationSeconds, 0) / 60)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader
        title="Generate Workout"
        subtitle="Build your perfect session"
      />

      {/* Block generation when workout is active */}
      {hasActiveWorkout && (
        <div className="mx-4 mb-4 p-4 bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 rounded-2xl flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#FF9F0A]">
              {isPaused ? 'Workout Paused' : 'Workout In Progress'}
            </p>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              {isPaused
                ? 'You have a paused workout. Resume or cancel it before generating a new one.'
                : 'Finish or pause your current workout before generating a new one.'}
            </p>
          </div>
          <Link
            to="/active"
            className="flex-shrink-0 text-xs font-semibold text-[#FF9F0A] underline"
          >
            {isPaused ? 'Resume' : 'Go to Workout'}
          </Link>
        </div>
      )}

      <div className="px-4 space-y-5 pb-6">
        {/* Duration */}
        <section>
          <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">
            Duration
          </h3>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border',
                  duration === d
                    ? 'bg-[#FF375F] text-white border-[#FF375F]'
                    : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
                )}
              >
                {formatDuration(d)}
              </button>
            ))}
          </div>
        </section>

        {/* Goal */}
        <section>
          <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">
            Goal
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                className={cn(
                  'flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-colors border text-left',
                  goal === g.value
                    ? 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/40'
                    : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
                )}
              >
                <span className="w-4 text-center">{g.icon}</span>
                {g.label}
              </button>
            ))}
          </div>
        </section>

        {/* Warmup toggle */}
        <section>
          <div className="flex items-center justify-between py-3 px-4 bg-[#1c1c1e] rounded-2xl border border-[#38383A]">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faPersonRunning} className="text-[#FF375F] w-4" />
              <div>
                <p className="text-sm font-semibold text-white">Include Warmup</p>
                <p className="text-xs text-[#8E8E93]">5-10 min cardio + stretching</p>
              </div>
            </div>
            <Switch checked={includeWarmup} onCheckedChange={setIncludeWarmup} />
          </div>
        </section>

        {/* Supersets toggle */}
        <section>
          <div className="flex items-center justify-between py-3 px-4 bg-[#1c1c1e] rounded-2xl border border-[#38383A]">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[#0A84FF] w-4" />
              <div>
                <p className="text-sm font-semibold text-white">Allow Supersets</p>
                <p className="text-xs text-[#8E8E93]">Pair antagonist muscles for efficiency</p>
              </div>
            </div>
            <Switch checked={allowSupersets} onCheckedChange={setAllowSupersets} />
          </div>
        </section>

        {/* Target Muscles (optional) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">
              Target Muscles
            </h3>
            <span className="text-xs text-[#8E8E93]">Optional</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_OPTIONS.map((m) => {
              const isSelected = targetMuscles.includes(m.value);
              return (
                <button
                  key={m.value}
                  onClick={() => toggleMuscle(m.value)}
                  className={cn(
                    'flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium transition-colors border',
                    isSelected
                      ? 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/40'
                      : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Generate button */}
        <Button
          size="lg"
          className="w-full"
          onClick={() => handleGenerate()}
          disabled={generateMutation.isPending || hasActiveWorkout}
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Generate Workout
            </>
          )}
        </Button>

        {/* Generated workout preview */}
        <AnimatePresence>
          {generateMutation.isPending && !generatedWorkout && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </motion.div>
          )}

          {generatedWorkout && !generateMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary row */}
              <div className="flex items-center justify-between bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4">
                <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(generatedWorkout.targetDurationMinutes)} estimated</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                  <ChevronRight className="h-4 w-4" />
                  <span>{generatedWorkout.exercises.length} exercises</span>
                </div>
              </div>

              {/* Warmup list (if present) */}
              {(generatedWorkout.warmup?.length ?? 0) > 0 && (
                <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#38383A]">
                    <FontAwesomeIcon icon={faPersonRunning} className="text-[#FF375F]" />
                    <span className="text-sm font-semibold text-white">Warmup</span>
                    <span className="text-xs text-[#8E8E93] ml-auto">{totalWarmupMinutes} min total</span>
                  </div>
                  <div className="divide-y divide-[#38383A]">
                    {generatedWorkout.warmup!.map((item, i) => {
                      const typeColors: Record<string, string> = {
                        cardio: 'bg-[#FF375F]/20 text-[#FF375F]',
                        stretch: 'bg-[#0A84FF]/20 text-[#0A84FF]',
                        mobility: 'bg-[#BF5AF2]/20 text-[#BF5AF2]',
                      };
                      const durationLabel = item.durationSeconds >= 60
                        ? `${Math.round(item.durationSeconds / 60)} min`
                        : `${item.durationSeconds}s`;
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${typeColors[item.type] ?? 'bg-gray-500/20 text-gray-400'}`}>
                            {item.type}
                          </span>
                          <span className="text-sm text-white flex-1">{item.name}</span>
                          <span className="text-xs text-[#8E8E93] flex-shrink-0">{durationLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exercise list */}
              <div className="space-y-2">
                {generatedWorkout.exercises.map((we, i) => {
                  const memberCount = we.supersetGroupId
                    ? generatedWorkout.exercises.filter(e => e.supersetGroupId === we.supersetGroupId).length
                    : undefined;
                  return (
                    <ExerciseItem
                      key={we.exerciseId}
                      workoutExercise={we}
                      index={i}
                      supersetMemberCount={memberCount}
                      onSwap={() => setSwapTarget(we)}
                    />
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-14 text-sm"
                  onClick={() => handleGenerate(generatedWorkout?.exercises.map(e => e.exerciseId))}
                  disabled={generateMutation.isPending || hasActiveWorkout}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  className="flex-[2] h-14"
                  size="lg"
                  onClick={handleStartWorkout}
                  disabled={createWorkoutMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2 fill-white" />
                  {createWorkoutMutation.isPending ? 'Starting...' : 'Start Workout'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swap exercise sheet */}
      {swapTarget && generatedWorkout && (
        <SwapExerciseSheet
          open={swapTarget !== null}
          workoutExercise={swapTarget}
          allExerciseIds={generatedWorkout.exercises.map(e => e.exerciseId)}
          onSwap={handleSwap}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  );
}
