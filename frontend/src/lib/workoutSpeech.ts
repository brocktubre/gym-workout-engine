import type { WorkoutExercise, WorkoutSet } from '@/types';

function setDetails(set: WorkoutSet | undefined): string {
  if (!set) return '';
  if (set.targetDurationSeconds !== undefined) return `${set.targetDurationSeconds} seconds`;
  if (set.targetHoldSeconds !== undefined) return `a ${set.targetHoldSeconds} second hold`;
  return set.targetWeight !== undefined && set.targetWeight > 0
    ? `${set.targetReps} reps at ${set.targetWeight} pounds`
    : `${set.targetReps} reps`;
}

function joinedNames(exercises: WorkoutExercise[]): string {
  const names = exercises.map((exercise) => exercise.exercise.name);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Announcement used when a workout starts without a warmup. */
export function initialWorkoutAnnouncement(exercises: WorkoutExercise[]): string | null {
  const first = exercises[0];
  if (!first) return null;

  const details = setDetails(first.sets[0]);
  const firstSet = details
    ? `Set number 1 of ${first.exercise.name} is ${details}.`
    : `Set number 1 of ${first.exercise.name}.`;

  if (first.supersetGroupId) {
    const members = exercises
      .filter((exercise) => exercise.supersetGroupId === first.supersetGroupId)
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
    const type =
      members.length === 2 ? 'superset'
      : members.length === 3 ? 'tri-set'
      : 'giant set';
    const setCount = Math.max(...members.map((member) => member.sets.length));
    const setWord = setCount === 1 ? 'set' : 'sets';
    return `Next up is a ${type} of ${joinedNames(members)}. ${setCount} ${setWord}. ${firstSet}`;
  }

  const setWord = first.sets.length === 1 ? 'set' : 'sets';
  return `Next up is ${first.sets.length} ${setWord} of ${first.exercise.name}. ${firstSet}`;
}
