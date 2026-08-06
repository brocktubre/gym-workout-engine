import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Zap, RefreshCw, Play, Clock, ChevronDown, ChevronUp, Check, GripVertical, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
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
import { AddExerciseSheet } from '@/components/workout/AddExerciseSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGenerateWorkout, useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { useCreateWorkout } from '@/hooks/useWorkouts';
import { useSettings } from '@/hooks/useSettings';
import { useTTS } from '@/hooks/useTTS';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { getTodayDate, formatDuration } from '@/lib/utils';
import {
  toBlocks,
  flattenBlocks,
  removeExercise,
  reorderBlocksByIds,
  type WorkoutBlock,
} from '@/lib/workoutBlocks';
import { buildWorkoutExercise } from '@/lib/buildWorkoutExercise';
import { getWarmupAnnouncement, getWarmupDisplayName } from '@/lib/warmup';
import { initialWorkoutAnnouncement } from '@/lib/workoutSpeech';
import type { MuscleGroup, WorkoutGoal, WorkoutExercise, WarmupItem, Exercise, WorkoutSet } from '@/types';
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

function DragHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="mt-0.5 h-7 w-7 rounded-lg bg-[#2c2c2e] flex items-center justify-center text-[#8E8E93] touch-none select-none no-touch-select cursor-grab active:cursor-grabbing flex-shrink-0"
      onPointerDown={onPointerDown}
      // Prevent click from expanding the card
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function supersetLabel(count: number) {
  if (count === 3) return 'Tri-Set';
  if (count >= 4) return 'Giant Set';
  return 'Superset';
}

interface ReorderBlockItemProps {
  block: WorkoutBlock;
  startIndex: number;
  canRemove: boolean;
  onSwap: (we: WorkoutExercise) => void;
  onRemove: (exerciseId: string) => void;
  onPrescriptionChange: (exerciseId: string, sets: WorkoutExercise['sets']) => void;
}

function ReorderBlockItem({
  block,
  startIndex,
  canRemove,
  onSwap,
  onRemove,
  onPrescriptionChange,
}: ReorderBlockItemProps) {
  const controls = useDragControls();

  const dragHandle = (
    <DragHandle
      onPointerDown={(e) => {
        e.preventDefault();
        // iOS may have already begun a selection on the long press
        window.getSelection()?.removeAllRanges();
        controls.start(e);
      }}
    />
  );

  if (block.kind === 'single') {
    return (
      <Reorder.Item
        value={block.id}
        dragListener={false}
        dragControls={controls}
        className="list-none"
      >
        <ExerciseItem
          workoutExercise={block.exercise}
          index={startIndex}
          onSwap={() => onSwap(block.exercise)}
          onRemove={() => onRemove(block.exercise.exerciseId)}
          removeDisabled={!canRemove}
          dragHandle={dragHandle}
          onPrescriptionChange={(sets) =>
            onPrescriptionChange(block.exercise.exerciseId, sets)
          }
        />
      </Reorder.Item>
    );
  }

  const memberCount = block.members.length;
  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      className="list-none"
    >
      <div className="rounded-2xl border border-[#0A84FF]/25 bg-[#0A84FF]/5 overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          {dragHandle}
          <div className="flex items-center gap-2 px-2 py-1 bg-[#0A84FF]/10 rounded-lg border border-[#0A84FF]/20">
            <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[#0A84FF] text-xs" />
            <span className="text-xs font-bold text-[#0A84FF] uppercase tracking-wider">
              {supersetLabel(memberCount)}
            </span>
            <div className="flex items-center gap-0.5 ml-1">
              {Array.from({ length: memberCount }, (_, i) => (
                <span key={i} className="text-[10px] font-bold text-[#0A84FF]/80">
                  {i > 0 && <span className="text-[#0A84FF]/40 mx-0.5">→</span>}
                  {String.fromCharCode(65 + i)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2 p-2 pt-1">
          {block.members.map((member, i) => (
            <ExerciseItem
              key={member.exerciseId}
              workoutExercise={member}
              index={startIndex + i}
              supersetMemberCount={memberCount}
              hideSupersetBadge
              onSwap={() => onSwap(member)}
              onRemove={() => onRemove(member.exerciseId)}
              removeDisabled={!canRemove}
              onPrescriptionChange={(sets) =>
                onPrescriptionChange(member.exerciseId, sets)
              }
            />
          ))}
        </div>
      </div>
    </Reorder.Item>
  );
}

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
  /** Workout passed back after account creation so the user can start it immediately */
  restoredWorkout?: GeneratedWorkout;
  /** When set, starting this workout marks the daily plan for that date complete */
  fromDailyDate?: string;
  /** Kick off generation as soon as the form is ready (AI Coach "Train This") */
  autoGenerate?: boolean;
}

export default function Generate() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as GenerateLocationState;
  const { data: settings, isFetched: settingsFetched } = useSettings();
  const fromDailyDate = locationState.fromDailyDate;
  const restored = locationState.restoredWorkout;
  const shouldAutoGenerate = Boolean(locationState.autoGenerate) && !restored;

  const [duration, setDuration] = useState(
    restored?.targetDurationMinutes ?? 60,
  );
  // Goal defaults: restored/AI suggestion > saved settings > fallback 'hypertrophy'
  const [goal, setGoal] = useState<WorkoutGoal>(
    locationState.suggestedGoal ?? settings?.goal ?? 'hypertrophy',
  );
  const [targetMuscles, setTargetMuscles] = useState<MuscleGroup[]>(locationState.suggestedMuscles ?? []);
  const [includeWarmup, setIncludeWarmup] = useState(
    restored ? (restored.warmup?.length ?? 0) > 0 : (settings?.includeWarmup ?? true),
  );
  const [allowSupersets, setAllowSupersets] = useState(settings?.allowSupersets ?? true);
  // Restore a workout that was saved before redirecting to register/login, or from daily edit
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(
    restored ?? null,
  );
  const [swapTarget, setSwapTarget] = useState<WorkoutExercise | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  // Sync goal + toggles from settings once they load (only if user hasn't
  // already changed them and no restored/AI suggestion was provided)
  const settingsSyncedRef = useRef(false);
  const [formReady, setFormReady] = useState(false);
  useEffect(() => {
    if (settingsSyncedRef.current) return;
    if (!settingsFetched) return;
    settingsSyncedRef.current = true;
    if (settings) {
      if (!locationState.suggestedGoal) setGoal(settings.goal);
      if (!restored) {
        setIncludeWarmup(settings.includeWarmup ?? true);
        if (settings.defaultDurationMinutes) setDuration(settings.defaultDurationMinutes);
      }
      setAllowSupersets(settings.allowSupersets ?? true);
    }
    setFormReady(true);
  }, [settings, settingsFetched]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwap = async (newExercise: Exercise) => {
    if (!swapTarget || !generatedWorkout) return;
    const targetId = swapTarget.exerciseId;
    const firstSet = swapTarget.sets[0];

    // Optimistic swap — keep set count until Claude returns a prescription
    setGeneratedWorkout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map(we =>
          we.exerciseId === targetId
            ? {
                ...we,
                exerciseId: newExercise.id,
                exercise: newExercise,
                progressionNote: undefined,
                sets: we.sets.map(s => ({
                  ...s,
                  completed: false,
                  completedReps: undefined,
                  completedWeight: undefined,
                  targetWeight:
                    newExercise.category === 'cardio'
                    || newExercise.equipment === 'bodyweight'
                    || newExercise.equipment === 'rings'
                    || newExercise.equipment === 'pull-up-bar'
                      ? undefined
                      : s.targetWeight,
                  targetHoldSeconds: newExercise.isHold ? newExercise.holdSeconds : undefined,
                  targetDurationSeconds: newExercise.durationSeconds,
                })),
              }
            : we,
        ),
      };
    });
    setSwapTarget(null);

    try {
      const { sets } = await api.swapPrescribe({
        newExerciseId: newExercise.id,
        replaced: {
          name: swapTarget.exercise.name,
          equipment: swapTarget.exercise.equipment,
          sets: swapTarget.sets.length,
          reps: firstSet?.targetReps ?? 10,
          weight: firstSet?.targetWeight ?? 0,
        },
        goal: generatedWorkout.goal,
        durationMinutes: generatedWorkout.targetDurationMinutes,
        restSeconds: firstSet?.restSeconds,
      });

      setGeneratedWorkout(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map(we =>
            we.exerciseId === newExercise.id
              ? {
                  ...we,
                  sets: sets.map((s, i) => ({
                    ...s,
                    // Preserve superset rest / metadata from the swapped slot
                    restSeconds: s.restSeconds ?? firstSet?.restSeconds ?? 90,
                    setNumber: i + 1,
                  })),
                }
              : we,
          ),
        };
      });
      toast({ title: `Swapped to ${newExercise.name}`, description: 'Load recalculated', duration: 2000 });
    } catch {
      toast({ title: `Swapped to ${newExercise.name}`, duration: 2000 });
    }
  };

  const handleRemove = (exerciseId: string) => {
    if (!generatedWorkout) return;
    if (generatedWorkout.exercises.length <= 1) {
      toast({ title: 'Keep at least one exercise in the workout' });
      return;
    }
    const removed = generatedWorkout.exercises.find((we) => we.exerciseId === exerciseId);
    setGeneratedWorkout((prev) => {
      if (!prev) return prev;
      return { ...prev, exercises: removeExercise(prev.exercises, exerciseId) };
    });
    toast({ title: `Removed ${removed?.exercise.name ?? 'exercise'}`, duration: 2000 });
  };

  const handleReorder = (orderedIds: string[]) => {
    setGeneratedWorkout((prev) => {
      if (!prev) return prev;
      const blocks = toBlocks(prev.exercises);
      return {
        ...prev,
        exercises: flattenBlocks(reorderBlocksByIds(blocks, orderedIds)),
      };
    });
  };

  const handleAddExercise = (exercise: Exercise) => {
    if (!generatedWorkout) return;
    const next = buildWorkoutExercise(
      exercise,
      generatedWorkout.goal,
      settings?.restBetweenSetsSeconds,
    );
    setGeneratedWorkout((prev) => {
      if (!prev) return prev;
      return { ...prev, exercises: [...prev.exercises, next] };
    });
    toast({ title: `Added ${exercise.name}`, duration: 2000 });
  };

  const handlePrescriptionChange = (exerciseId: string, sets: WorkoutSet[]) => {
    setGeneratedWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((we) =>
          we.exerciseId === exerciseId
            ? { ...we, sets, progressionNote: undefined }
            : we,
        ),
      };
    });
  };

  const workoutBlocks = useMemo(
    () => (generatedWorkout ? toBlocks(generatedWorkout.exercises) : []),
    [generatedWorkout],
  );

  const generateMutation = useGenerateWorkout();
  const createWorkoutMutation = useCreateWorkout();
  const { startWorkout, hasActiveWorkout, isPaused } = useActiveWorkout();
  const { speak } = useTTS();

  // Warmup item expand/collapse state (Generate preview)
  const [expandedWarmupItems, setExpandedWarmupItems] = useState<Set<number>>(new Set());
  const [warmupSectionExpanded, setWarmupSectionExpanded] = useState(true);
  const toggleWarmupPreview = (i: number) =>
    setExpandedWarmupItems(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const ALL_MUSCLE_VALUES = MUSCLE_OPTIONS.map((m) => m.value);
  const isFullBodySelected = ALL_MUSCLE_VALUES.every((m) => targetMuscles.includes(m));

  const toggleMuscle = (muscle: MuscleGroup) => {
    setTargetMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  };

  const toggleFullBody = () => {
    setTargetMuscles(isFullBodySelected ? [] : [...ALL_MUSCLE_VALUES]);
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

  // AI Coach "Train This" — generate once the form has picked up settings + suggestions
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoGenerate || autoGeneratedRef.current || !formReady || hasActiveWorkout) return;
    autoGeneratedRef.current = true;
    void handleGenerate();
    // Intentionally omit handleGenerate — fire once with the ready form values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, formReady, hasActiveWorkout, duration, goal, targetMuscles, includeWarmup, allowSupersets]);

  const handleStartWorkout = async () => {
    if (!generatedWorkout) return;

    // Anonymous users must sign in before starting a workout
    if (!isAuthenticated) {
      setSignInPromptOpen(true);
      return;
    }

    try {
      const now = new Date().toISOString();
      const hasWarmup = (generatedWorkout.warmup?.length ?? 0) > 0;
      const workout = await createWorkoutMutation.mutateAsync({
        date: getTodayDate(),
        createdAt: now,
        status: 'in-progress',
        startedAt: now,       // anchors the elapsed timer accurately
        totalPausedMs: 0,
        exercises: generatedWorkout.exercises,
        targetDurationMinutes: generatedWorkout.targetDurationMinutes,
        goal: generatedWorkout.goal,
        warmup: generatedWorkout.warmup,
        warmupStatus: hasWarmup ? 'pending' : 'skipped',
        ...(fromDailyDate ? { fromDailyDate } : {}),
      });

      startWorkout(workout);

      // Announce the first warmup item via Polly TTS
      const firstWarmup = workout.warmup?.[0];
      if (firstWarmup) {
        speak(`Warm Up. ${getWarmupAnnouncement(firstWarmup)}`);
      } else {
        const announcement = initialWorkoutAnnouncement(workout.exercises);
        if (announcement) speak(announcement);
      }

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

  const isDailyEdit = Boolean(fromDailyDate && generatedWorkout);
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === goal)?.label ?? goal;
  const muscleSummary =
    targetMuscles.length === 0
      ? 'Engine pick'
      : isFullBodySelected
        ? 'Full body'
        : targetMuscles
            .map((m) => MUSCLE_OPTIONS.find((o) => o.value === m)?.label ?? m)
            .join(', ');

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PageHeader
        title="Workout"
        subtitle={fromDailyDate ? 'Edit today’s daily workout' : 'Build your perfect session'}
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
        {isDailyEdit ? (
          /* Read-only snapshot of the settings used for today’s daily plan */
          <section className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#8E8E93] uppercase tracking-wider">
              Today’s plan settings
            </h3>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-[#8E8E93]">Duration</dt>
                <dd className="text-sm font-semibold text-white">
                  {formatDuration(generatedWorkout!.targetDurationMinutes)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-[#8E8E93]">Goal</dt>
                <dd className="text-sm font-semibold text-white">{goalLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-[#8E8E93]">Include Warmup</dt>
                <dd className="text-sm font-semibold text-white">
                  {(generatedWorkout!.warmup?.length ?? 0) > 0 ? 'On' : 'Off'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-[#8E8E93]">Allow Supersets</dt>
                <dd className="text-sm font-semibold text-white">
                  {allowSupersets ? 'On' : 'Off'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-sm text-[#8E8E93] shrink-0">Target Muscles</dt>
                <dd className="text-sm font-semibold text-white text-right">{muscleSummary}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <>
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
                <p className="text-xs text-[#8E8E93]">Cardio + stretching before your workout</p>
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
            {/* Full Body shortcut */}
            <button
              onClick={toggleFullBody}
              className={cn(
                'flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium transition-colors border',
                isFullBodySelected
                  ? 'bg-[#FF375F]/20 text-[#FF375F] border-[#FF375F]/40'
                  : 'bg-[#1c1c1e] text-[#8E8E93] border-[#38383A] hover:bg-[#2c2c2e]',
              )}
            >
              Full Body
            </button>

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
          </>
        )}

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
                <div className="text-sm text-[#8E8E93]">
                  <span>{generatedWorkout.exercises.length} exercises</span>
                </div>
              </div>

              {/* Warmup preview — section collapses to shorten a long generated list */}
              {(generatedWorkout.warmup?.length ?? 0) > 0 && (
                <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] overflow-hidden">
                  <button
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 px-4 py-3 text-left',
                      warmupSectionExpanded && 'border-b border-[#38383A]',
                    )}
                    onClick={() => setWarmupSectionExpanded((prev) => !prev)}
                    aria-expanded={warmupSectionExpanded}
                  >
                    <FontAwesomeIcon icon={faPersonRunning} className="text-[#FF375F]" />
                    <span className="text-sm font-semibold text-white">Warmup</span>
                    <span className="text-xs text-[#8E8E93]">
                      {generatedWorkout.warmup!.length} items · {totalWarmupMinutes} min
                    </span>
                    <span className="ml-auto flex-shrink-0">
                      {warmupSectionExpanded
                        ? <ChevronUp className="h-4 w-4 text-[#8E8E93]" />
                        : <ChevronDown className="h-4 w-4 text-[#8E8E93]" />}
                    </span>
                  </button>
                  {warmupSectionExpanded && (
                  <div className="divide-y divide-[#38383A]">
                    {generatedWorkout.warmup!.map((item, i) => {
                      const typeColors: Record<string, string> = {
                        cardio: 'bg-[#FF375F]/20 text-[#FF375F]',
                        stretch: 'bg-[#0A84FF]/20 text-[#0A84FF]',
                        mobility: 'bg-[#BF5AF2]/20 text-[#BF5AF2]',
                        activation: 'bg-[#30D158]/20 text-[#30D158]',
                      };
                      const durationLabel = item.durationSeconds >= 60
                        ? `${Math.round(item.durationSeconds / 60)} min`
                        : `${item.durationSeconds}s`;
                      const isExpanded = expandedWarmupItems.has(i);
                      const hasInstructions = (item.instructions?.length ?? 0) > 0;
                      return (
                        <div key={i}>
                          <div className="w-full flex items-center gap-3 px-4 py-3">
                            <button
                              type="button"
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                              onClick={() => hasInstructions && toggleWarmupPreview(i)}
                              aria-expanded={hasInstructions ? isExpanded : undefined}
                            >
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${typeColors[item.type] ?? 'bg-gray-500/20 text-gray-400'}`}>
                                {item.type}
                              </span>
                              <span className="text-sm text-white flex-1">
                                {getWarmupDisplayName(item.name)}
                              </span>
                              <span className="text-xs text-[#8E8E93] flex-shrink-0">{durationLabel}</span>
                              {hasInstructions && (
                                isExpanded
                                  ? <ChevronUp className="h-3.5 w-3.5 text-[#8E8E93] flex-shrink-0" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-[#8E8E93] flex-shrink-0" />
                              )}
                            </button>
                          </div>
                          {isExpanded && hasInstructions && (
                            <ul className="px-4 pb-3 space-y-1 border-t border-[#2c2c2e]">
                              {item.instructions.map((instr, j) => (
                                <li key={j} className="text-xs text-[#8E8E93] flex gap-1.5 pt-1">
                                  <span className="text-[#48484A] flex-shrink-0">{j + 1}.</span>
                                  <span>{instr}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}

              {/* Exercise list — reorderable by block; warmup stays above */}
              <Reorder.Group
                axis="y"
                values={workoutBlocks.map((b) => b.id)}
                onReorder={handleReorder}
                as="div"
                className="space-y-2 select-none no-touch-select"
              >
                {workoutBlocks.map((block, blockIndex) => {
                  const startIndex = workoutBlocks
                    .slice(0, blockIndex)
                    .reduce(
                      (sum, b) => sum + (b.kind === 'single' ? 1 : b.members.length),
                      0,
                    );
                  return (
                    <ReorderBlockItem
                      key={block.id}
                      block={block}
                      startIndex={startIndex}
                      canRemove={generatedWorkout.exercises.length > 1}
                      onSwap={setSwapTarget}
                      onRemove={handleRemove}
                      onPrescriptionChange={handlePrescriptionChange}
                    />
                  );
                })}
              </Reorder.Group>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-dashed border-[#48484A] text-[#8E8E93] hover:text-white hover:border-[#8E8E93]"
                onClick={() => setAddSheetOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Movement
              </Button>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                {!isDailyEdit && (
                  <Button
                    variant="outline"
                    className="flex-1 h-14 text-sm"
                    onClick={() => handleGenerate(generatedWorkout?.exercises.map(e => e.exerciseId))}
                    disabled={generateMutation.isPending || hasActiveWorkout}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                )}
                <Button
                  className={cn('h-14', isDailyEdit ? 'w-full' : 'flex-[2]')}
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

      {generatedWorkout && (
        <AddExerciseSheet
          open={addSheetOpen}
          excludeIds={generatedWorkout.exercises.map((e) => e.exerciseId)}
          onAdd={handleAddExercise}
          onClose={() => setAddSheetOpen(false)}
        />
      )}

      {/* Sign-in prompt for anonymous users */}
      <Dialog open={signInPromptOpen} onOpenChange={setSignInPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to Start Training</DialogTitle>
            <DialogDescription>Create a free account to:</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 py-1">
            {[
              'Start workouts',
              'Track your progress',
              'Save workout history',
              'Sync across devices',
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5 text-sm text-white">
                <Check className="h-4 w-4 text-[#30D158] flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSignInPromptOpen(false);
                navigate('/login', { state: { returnUrl: '/generate', restoredWorkout: generatedWorkout } });
              }}
            >
              Sign In
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSignInPromptOpen(false);
                // Pass the generated workout so Register can send the user back here after signup
                navigate('/register', { state: { restoredWorkout: generatedWorkout } });
              }}
            >
              Create Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
