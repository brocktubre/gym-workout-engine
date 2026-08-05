import type { Exercise, WorkoutExercise, WorkoutGoal, WorkoutSet } from '@/types';

const VOLUME_BY_GOAL: Record<
  WorkoutGoal,
  { sets: number; minReps: number; maxReps: number; restSeconds: number }
> = {
  strength: { sets: 5, minReps: 3, maxReps: 5, restSeconds: 180 },
  hypertrophy: { sets: 4, minReps: 8, maxReps: 12, restSeconds: 90 },
  endurance: { sets: 3, minReps: 15, maxReps: 20, restSeconds: 45 },
  'fat-loss': { sets: 3, minReps: 12, maxReps: 15, restSeconds: 60 },
};

/** Build a standalone WorkoutExercise with goal-appropriate default sets. */
export function buildWorkoutExercise(
  exercise: Exercise,
  goal: WorkoutGoal,
  restSecondsOverride?: number,
): WorkoutExercise {
  const config = VOLUME_BY_GOAL[goal] ?? VOLUME_BY_GOAL.hypertrophy;
  const restSeconds = restSecondsOverride ?? config.restSeconds;
  const targetReps = Math.round((config.minReps + config.maxReps) / 2);

  let sets: WorkoutSet[];

  if (exercise.durationSeconds) {
    sets = Array.from({ length: config.sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: 1,
      targetDurationSeconds: exercise.durationSeconds,
      completed: false,
      restSeconds,
    }));
  } else if (exercise.isHold && exercise.holdSeconds) {
    sets = Array.from({ length: config.sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps: 1,
      targetHoldSeconds: exercise.holdSeconds,
      completed: false,
      restSeconds,
    }));
  } else {
    sets = Array.from({ length: config.sets }, (_, i) => ({
      setNumber: i + 1,
      targetReps,
      completed: false,
      restSeconds,
    }));
  }

  return {
    exerciseId: exercise.id,
    exercise,
    sets,
  };
}
