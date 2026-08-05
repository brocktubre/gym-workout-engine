import { useState } from 'react';
import { Clock, CheckCircle2, Dumbbell, Trash2 } from 'lucide-react';
import { formatDate, formatDuration } from '@/lib/utils';
import { MuscleGroupBadge } from '@/components/workout/MuscleGroupBadge';
import { Button } from '@/components/ui/button';
import { useDeleteWorkout } from '@/hooks/useWorkouts';
import { useActiveWorkout } from '@/hooks/useWorkoutEngine';
import { toast } from '@/components/ui/use-toast';
import type { Workout, MuscleGroup } from '@/types';

interface RecentWorkoutProps {
  workout: Workout;
}

export function RecentWorkout({ workout }: RecentWorkoutProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteWorkout();
  const { activeWorkout, clearActiveWorkout } = useActiveWorkout();

  const muscles: MuscleGroup[] = Array.from(
    new Set(workout.exercises.map((e) => e.exercise.primaryMuscle)),
  ).slice(0, 2);

  const isCompleted = workout.status === 'completed';
  const canDelete = isCompleted || workout.status === 'in-progress';

  return (
    <div className="py-3">
      {/* Main row */}
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isCompleted ? 'bg-[#30D158]/20' : 'bg-[#2c2c2e]'
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-[#30D158]" />
          ) : (
            <Dumbbell className="h-5 w-5 text-[#8E8E93]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{formatDate(workout.date)}</p>
            <div className="flex gap-1">
              {muscles.map((m) => (
                <MuscleGroupBadge key={m} muscle={m} size="sm" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[#8E8E93] flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(workout.actualDurationMinutes ?? workout.targetDurationMinutes)}
            </span>
            <span className="text-xs text-[#8E8E93]">
              {workout.exercises.length} exercises
            </span>
            {workout.totalVolume != null && workout.totalVolume > 0 && (
              <span className="text-xs text-[#8E8E93]">
                {workout.totalVolume.toLocaleString()}lbs vol
              </span>
            )}
          </div>
        </div>

        {/* Status badge + delete button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
              isCompleted
                ? 'bg-[#30D158]/20 text-[#30D158]'
                : workout.status === 'in-progress'
                ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
                : 'bg-[#2c2c2e] text-[#8E8E93]'
            }`}
          >
            {workout.status?.replace('-', ' ') ?? ''}
          </span>
          {canDelete && (
            <button
              onClick={() => setShowDeleteConfirm((v) => !v)}
              className="h-7 w-7 rounded-lg bg-[#2c2c2e] flex items-center justify-center text-[#8E8E93] hover:text-[#FF375F] hover:bg-[#FF375F]/10 transition-colors"
              title="Delete workout"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline delete confirmation */}
      {showDeleteConfirm && (
        <div className="mt-2 p-3 bg-[#2c2c2e] rounded-xl border border-[#FF375F]/30">
          <p className="text-xs font-medium text-white mb-1">Delete this workout?</p>
          <p className="text-xs text-[#8E8E93] mb-3">This cannot be undone.</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Keep It
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 text-xs"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                try {
                  // Clear local active session if this is the workout currently in progress
                  if (activeWorkout?.id === workout.id) {
                    clearActiveWorkout();
                  }
                  await deleteMutation.mutateAsync({ date: workout.date, id: workout.id });
                  toast({ title: 'Workout deleted', variant: 'success', duration: 2000 });
                } catch {
                  toast({ title: 'Failed to delete workout', variant: 'error', duration: 3000 });
                  setShowDeleteConfirm(false);
                }
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
