import { Clock, CheckCircle2, Dumbbell } from 'lucide-react';
import { formatDate, formatDuration } from '@/lib/utils';
import { MuscleGroupBadge } from '@/components/workout/MuscleGroupBadge';
import type { Workout, MuscleGroup } from '@/types';

interface RecentWorkoutProps {
  workout: Workout;
}

export function RecentWorkout({ workout }: RecentWorkoutProps) {
  const muscles: MuscleGroup[] = Array.from(
    new Set(workout.exercises.map((e) => e.exercise.primaryMuscle)),
  ).slice(0, 2);

  const isCompleted = workout.status === 'completed';

  return (
    <div className="flex items-center gap-3 py-3 px-0">
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isCompleted
            ? 'bg-[#30D158]/20'
            : 'bg-[#2c2c2e]'
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
      <span
        className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
          isCompleted
            ? 'bg-[#30D158]/20 text-[#30D158]'
            : workout.status === 'in-progress'
            ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
            : 'bg-[#2c2c2e] text-[#8E8E93]'
        }`}
      >
        {workout.status.replace('-', ' ')}
      </span>
    </div>
  );
}
