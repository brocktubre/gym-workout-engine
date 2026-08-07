import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Clock, RefreshCw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MuscleGroupBadge } from '@/components/workout/MuscleGroupBadge';
import { useCreateWorkout } from '@/hooks/useWorkouts';
import { useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { useTTS } from '@/hooks/useTTS';
import { useSettings } from '@/hooks/useSettings';
import { useRegenerateDailyWorkout } from '@/hooks/useDailyWorkout';
import { toast } from '@/components/ui/use-toast';
import { cn, formatDuration, getTodayDate } from '@/lib/utils';
import { getWarmupAnnouncement } from '@/lib/warmup';
import { initialWorkoutAnnouncement } from '@/lib/workoutSpeech';
import { toBlocks, type WorkoutBlock } from '@/lib/workoutBlocks';
import type { DailyWorkout } from '@/hooks/useDailyWorkout';
import type { WorkoutExercise } from '@/types';

function setTargetLabel(we: WorkoutExercise): string {
  const set = we.sets[0];
  const setCount = we.sets.length;
  if (!set) return `${setCount} sets`;
  if (set.targetDurationSeconds !== undefined) {
    return `${setCount} × ${set.targetDurationSeconds}s`;
  }
  if (set.targetHoldSeconds !== undefined) {
    return `${setCount} × Hold ${set.targetHoldSeconds}s`;
  }
  const weight =
    set.targetWeight !== undefined && set.targetWeight > 0
      ? ` @ ${set.targetWeight}lbs`
      : '';
  return `${setCount} × ${set.targetReps ?? '?'} reps${weight}`;
}

function circuitLabel(count: number) {
  if (count === 3) return 'Tri-Set';
  if (count >= 4) return 'Giant Set';
  return 'Superset';
}

/** Rotate accents so adjacent circuits read as distinct groups. */
const CIRCUIT_ACCENTS = [
  {
    border: 'border-[#0A84FF]/35',
    bg: 'bg-[#0A84FF]/8',
    rail: 'bg-[#0A84FF]',
    text: 'text-[#0A84FF]',
    chip: 'bg-[#0A84FF]/15 border-[#0A84FF]/25',
    soft: 'text-[#0A84FF]/55',
  },
  {
    border: 'border-[#30D158]/35',
    bg: 'bg-[#30D158]/8',
    rail: 'bg-[#30D158]',
    text: 'text-[#30D158]',
    chip: 'bg-[#30D158]/15 border-[#30D158]/25',
    soft: 'text-[#30D158]/55',
  },
  {
    border: 'border-[#FF9F0A]/35',
    bg: 'bg-[#FF9F0A]/8',
    rail: 'bg-[#FF9F0A]',
    text: 'text-[#FF9F0A]',
    chip: 'bg-[#FF9F0A]/15 border-[#FF9F0A]/25',
    soft: 'text-[#FF9F0A]/55',
  },
  {
    border: 'border-[#64D2FF]/35',
    bg: 'bg-[#64D2FF]/8',
    rail: 'bg-[#64D2FF]',
    text: 'text-[#64D2FF]',
    chip: 'bg-[#64D2FF]/15 border-[#64D2FF]/25',
    soft: 'text-[#64D2FF]/55',
  },
] as const;

function MovementRow({
  we,
  letter,
  accentClass,
}: {
  we: WorkoutExercise;
  letter?: string;
  accentClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <p className="text-sm text-white truncate min-w-0 flex items-center gap-1.5">
        {letter && (
          <span
            className={cn(
              'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
              accentClass ?? 'bg-[#0A84FF]/15 text-[#0A84FF]',
            )}
          >
            {letter}
          </span>
        )}
        <span className="truncate">{we.exercise.name}</span>
      </p>
      <span className="text-xs text-[#8E8E93] flex-shrink-0 tabular-nums">
        {setTargetLabel(we)}
      </span>
    </div>
  );
}

function CircuitBlock({ block, accentIndex }: { block: WorkoutBlock; accentIndex: number }) {
  const accent = CIRCUIT_ACCENTS[accentIndex % CIRCUIT_ACCENTS.length];

  if (block.kind === 'single') {
    return (
      <div
        className={cn(
          'relative rounded-xl border pl-3 pr-3 py-1.5 overflow-hidden',
          'border-[#38383A] bg-[#2c2c2e]/40',
        )}
      >
        <span
          className={cn('absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full', accent.rail)}
          aria-hidden
        />
        <MovementRow we={block.exercise} />
      </div>
    );
  }

  const memberCount = block.members.length;
  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        accent.border,
        accent.bg,
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5',
            accent.chip,
          )}
        >
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', accent.text)}>
            {circuitLabel(memberCount)}
          </span>
          <span className={cn('text-[10px] font-bold', accent.text)}>
            {Array.from({ length: memberCount }, (_, i) => (
              <span key={i}>
                {i > 0 && <span className={cn('mx-0.5', accent.soft)}>→</span>}
                {String.fromCharCode(65 + i)}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="px-3 pb-2 divide-y divide-white/5">
        {block.members.map((member, i) => (
          <MovementRow
            key={member.exerciseId}
            we={member}
            letter={String.fromCharCode(65 + i)}
            accentClass={cn(accent.chip, accent.text)}
          />
        ))}
      </div>
    </div>
  );
}

interface DailyWorkoutCardProps {
  daily: DailyWorkout;
  isLoading?: boolean;
}

export function DailyWorkoutCard({ daily, isLoading }: DailyWorkoutCardProps) {
  const navigate = useNavigate();
  const createWorkoutMutation = useCreateWorkout();
  const regenerateMutation = useRegenerateDailyWorkout();
  const { data: settings } = useSettings();
  const { startWorkout, hasActiveWorkout } = useActiveWorkout();
  const { speak } = useTTS();
  const [starting, setStarting] = useState(false);

  const allowRegenerate = settings?.allowDailyRegenerate === true;
  const regenerating = regenerateMutation.isPending;
  const busy = starting || createWorkoutMutation.isPending || regenerating || hasActiveWorkout;
  const circuits = useMemo(
    () => toBlocks(daily.workout?.exercises ?? []),
    [daily.workout?.exercises],
  );

  if (isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  if (daily.status === 'completed') return null;

  const { workout } = daily;
  const muscles = daily.targetMuscleGroups.slice(0, 4);
  const circuitCount = circuits.length;

  const handleStart = async () => {
    if (hasActiveWorkout) {
      toast({
        title: 'Finish or cancel your current workout first',
        variant: 'error',
        duration: 3000,
      });
      return;
    }

    setStarting(true);
    try {
      const now = new Date().toISOString();
      const hasWarmup = (workout.warmup?.length ?? 0) > 0;
      const created = await createWorkoutMutation.mutateAsync({
        date: getTodayDate(),
        createdAt: now,
        status: 'in-progress',
        startedAt: now,
        totalPausedMs: 0,
        exercises: workout.exercises,
        targetDurationMinutes: workout.targetDurationMinutes,
        goal: workout.goal,
        warmup: workout.warmup,
        warmupStatus: hasWarmup ? 'pending' : 'skipped',
        fromDailyDate: daily.localDate,
      });
      startWorkout(created);

      const firstWarmup = created.warmup?.[0];
      if (firstWarmup) {
        speak(`Warm Up. ${getWarmupAnnouncement(firstWarmup)}`);
      } else {
        const announcement = initialWorkoutAnnouncement(created.exercises);
        if (announcement) speak(announcement);
      }

      navigate('/active');
    } catch (err) {
      toast({
        title: 'Could not start daily workout',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    } finally {
      setStarting(false);
    }
  };

  const handleEdit = () => {
    navigate('/generate', {
      state: {
        restoredWorkout: {
          exercises: workout.exercises,
          goal: workout.goal,
          targetDurationMinutes: workout.targetDurationMinutes,
          warmup: workout.warmup,
        },
        suggestedGoal: workout.goal,
        suggestedMuscles: daily.targetMuscleGroups,
        fromDailyDate: daily.localDate,
      },
    });
  };

  const handleRegenerate = async () => {
    if (hasActiveWorkout) {
      toast({
        title: 'Finish or cancel your current workout first',
        variant: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      await regenerateMutation.mutateAsync(daily.localDate);
      toast({
        title: 'Daily workout regenerated',
        variant: 'success',
        duration: 2500,
      });
    } catch (err) {
      toast({
        title: 'Could not regenerate workout',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1c1c1e] rounded-2xl border border-[#FF375F]/30 overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 border-b border-[#38383A]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF375F]">
              Daily Workout
            </p>
            <h2 className="text-base font-bold text-white mt-0.5 capitalize">
              {workout.goal?.replace('-', ' ') ?? 'Training'} · {formatDuration(workout.targetDurationMinutes)}
            </h2>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {muscles.map((m) => (
                <MuscleGroupBadge key={m} muscle={m} size="sm" />
              ))}
              <span className="text-[10px] text-[#8E8E93] flex items-center gap-1 ml-1">
                <Clock className="h-3 w-3" />
                {circuitCount} circuit{circuitCount === 1 ? '' : 's'} · {workout.exercises.length}{' '}
                movements
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {circuits.map((block, i) => (
          <CircuitBlock key={block.id} block={block} accentIndex={i} />
        ))}
      </div>

      <div className="px-4 pb-4 pt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-11"
            onClick={handleStart}
            disabled={busy}
          >
            {starting || createWorkoutMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1.5 fill-white" />
                Start Workout
              </>
            )}
          </Button>
          <Button
            className="h-11"
            variant="secondary"
            onClick={handleEdit}
            disabled={busy}
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit Workout
          </Button>
        </div>
        {allowRegenerate && (
          <Button
            className="w-full h-11"
            variant="secondary"
            onClick={handleRegenerate}
            disabled={busy}
          >
            {regenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Regenerate Workout
              </>
            )}
          </Button>
        )}
        {hasActiveWorkout && (
          <p className="text-[10px] text-[#8E8E93] text-center">
            Finish or pause your current session to start or edit today’s workout
          </p>
        )}
      </div>
    </motion.div>
  );
}
