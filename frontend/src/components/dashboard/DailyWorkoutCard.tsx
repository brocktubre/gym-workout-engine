import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Clock, RefreshCw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MuscleGroupBadge } from '@/components/workout/MuscleGroupBadge';
import { useCreateWorkout } from '@/hooks/useWorkouts';
import { useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { useTTS } from '@/hooks/useTTS';
import { toast } from '@/components/ui/use-toast';
import { formatDuration, getTodayDate } from '@/lib/utils';
import { getWarmupAnnouncement } from '@/lib/warmup';
import { initialWorkoutAnnouncement } from '@/lib/workoutSpeech';
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

interface DailyWorkoutCardProps {
  daily: DailyWorkout;
  isLoading?: boolean;
}

export function DailyWorkoutCard({ daily, isLoading }: DailyWorkoutCardProps) {
  const navigate = useNavigate();
  const createWorkoutMutation = useCreateWorkout();
  const { startWorkout, hasActiveWorkout } = useActiveWorkout();
  const { speak } = useTTS();
  const [starting, setStarting] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  if (daily.status === 'completed') return null;

  const { workout } = daily;
  const muscles = daily.targetMuscleGroups.slice(0, 4);

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
                {workout.exercises.length} movements
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 divide-y divide-[#2c2c2e]">
        {workout.exercises.map((we) => (
          <div key={we.exerciseId} className="flex items-center justify-between gap-3 py-2">
            <p className="text-sm text-white truncate min-w-0">
              {we.supersetOrder && we.supersetOrder > 1 ? (
                <span className="text-[#0A84FF] text-xs font-bold mr-1.5">
                  {String.fromCharCode(64 + we.supersetOrder)}
                </span>
              ) : we.supersetGroupId ? (
                <span className="text-[#0A84FF] text-xs font-bold mr-1.5">A</span>
              ) : null}
              {we.exercise.name}
            </p>
            <span className="text-xs text-[#8E8E93] flex-shrink-0 tabular-nums">
              {setTargetLabel(we)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 pt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-11"
            onClick={handleStart}
            disabled={starting || createWorkoutMutation.isPending || hasActiveWorkout}
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
            disabled={starting || createWorkoutMutation.isPending || hasActiveWorkout}
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit Workout
          </Button>
        </div>
        {hasActiveWorkout && (
          <p className="text-[10px] text-[#8E8E93] text-center">
            Finish or pause your current session to start or edit today’s workout
          </p>
        )}
      </div>
    </motion.div>
  );
}
