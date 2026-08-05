import type { Exercise, Workout } from '@/types';

const FOREARM_PLANK: Exercise = {
  id: 'ex_forearm_plank',
  name: 'Forearm Plank',
  primaryMuscle: 'core',
  secondaryMuscles: ['shoulders'],
  equipment: 'bodyweight',
  category: 'isolation',
  movementType: 'core',
  difficulty: 'beginner',
  isHold: true,
  holdSeconds: 30,
  instructions: [
    'Place forearms on the ground with your elbows bent at a 90° angle aligned beneath your shoulders, with your arms parallel at shoulder-width',
    'Your feet should be together, with only your toes touching the floor',
    'Lift your belly off the floor and form a straight line from your heels to the crown of your head and hold',
  ],
  tips: [
    'Do not allow your hips to sag or rise',
    'Keep your neck neutral and look toward the floor',
    'Squeeze your glutes and quads for full-body tension',
  ],
};

/**
 * Replace removed exercise snapshots embedded in older saved workouts.
 * The old generic Plank used forearm-plank instructions, so that is the
 * least-surprising migration while new workouts can select either explicit
 * Hand Plank or Forearm Plank from the current catalog.
 */
export function migrateLegacyWorkout(workout: Workout): {
  workout: Workout;
  changed: boolean;
} {
  let changed = false;
  const exercises = workout.exercises.map((workoutExercise) => {
    const isGenericPlank = workoutExercise.exerciseId === 'ex_plank'
      || workoutExercise.exercise.name.trim().toLowerCase() === 'plank';
    if (isGenericPlank) {
      changed = true;
      return {
        ...workoutExercise,
        exerciseId: FOREARM_PLANK.id,
        exercise: FOREARM_PLANK,
      };
    }

    const isJumpRope = workoutExercise.exerciseId === 'ex_jump_rope'
      || workoutExercise.exercise.name.trim().toLowerCase() === 'jump rope';
    const needsTimedSets = isJumpRope && (
      workoutExercise.exercise.durationSeconds !== 30
      || workoutExercise.sets.some((set) => set.targetDurationSeconds === undefined)
    );
    if (!needsTimedSets) return workoutExercise;

    changed = true;
    return {
      ...workoutExercise,
      exercise: {
        ...workoutExercise.exercise,
        isHold: undefined,
        holdSeconds: undefined,
        durationSeconds: 30,
      },
      sets: workoutExercise.sets.map((set) => ({
        ...set,
        targetReps: 1,
        completedReps: undefined,
        targetHoldSeconds: undefined,
        completedHoldSeconds: undefined,
        targetDurationSeconds: 30,
        completedDurationSeconds: set.completed ? 30 : undefined,
      })),
    };
  });

  return {
    workout: changed ? { ...workout, exercises } : workout,
    changed,
  };
}
