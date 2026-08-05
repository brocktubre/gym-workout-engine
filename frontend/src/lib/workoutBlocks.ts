import type { WorkoutExercise } from '@/types';

/** A drag unit on the Generate screen — a standalone exercise or a whole superset. */
export type WorkoutBlock =
  | { kind: 'single'; id: string; exercise: WorkoutExercise }
  | { kind: 'group'; id: string; groupId: string; members: WorkoutExercise[] };

/** Collapse adjacent same-group members into drag units (order-preserving). */
export function toBlocks(exercises: WorkoutExercise[]): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = [];
  const seenGroups = new Set<string>();

  for (const exercise of exercises) {
    const groupId = exercise.supersetGroupId;
    if (!groupId) {
      blocks.push({ kind: 'single', id: exercise.exerciseId, exercise });
      continue;
    }
    if (seenGroups.has(groupId)) continue;
    seenGroups.add(groupId);

    const members = exercises
      .filter((candidate) => candidate.supersetGroupId === groupId)
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));

    if (members.length < 2) {
      // Stale / broken group metadata — treat as singles
      for (const member of members) {
        blocks.push({
          kind: 'single',
          id: member.exerciseId,
          exercise: { ...member, supersetGroupId: undefined, supersetOrder: undefined },
        });
      }
      continue;
    }

    blocks.push({ kind: 'group', id: `group:${groupId}`, groupId, members });
  }

  return blocks;
}

/** Flatten drag units back into a linear exercise list. */
export function flattenBlocks(blocks: WorkoutBlock[]): WorkoutExercise[] {
  const exercises: WorkoutExercise[] = [];
  for (const block of blocks) {
    if (block.kind === 'single') {
      exercises.push(block.exercise);
    } else {
      exercises.push(...block.members);
    }
  }
  return exercises;
}

/**
 * Remove one exercise. Remaining members of its former group keep the group
 * if 2+ remain (renumbered); a lone leftover becomes a standalone exercise.
 */
export function removeExercise(
  exercises: WorkoutExercise[],
  exerciseId: string,
): WorkoutExercise[] {
  const removed = exercises.find((exercise) => exercise.exerciseId === exerciseId);
  if (!removed) return exercises;

  const groupId = removed.supersetGroupId;
  const remaining = exercises.filter((exercise) => exercise.exerciseId !== exerciseId);
  if (!groupId) return remaining;

  const groupMembers = remaining.filter((exercise) => exercise.supersetGroupId === groupId);
  if (groupMembers.length < 2) {
    return remaining.map((exercise) =>
      exercise.supersetGroupId === groupId
        ? { ...exercise, supersetGroupId: undefined, supersetOrder: undefined }
        : exercise,
    );
  }

  const orderById = new Map(
    groupMembers
      .slice()
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
      .map((member, index) => [member.exerciseId, index + 1] as const),
  );

  return remaining.map((exercise) => {
    if (exercise.supersetGroupId !== groupId) return exercise;
    return { ...exercise, supersetOrder: orderById.get(exercise.exerciseId) ?? exercise.supersetOrder };
  });
}

/** Reorder blocks by an ordered list of block ids from Reorder.Group. */
export function reorderBlocksByIds(
  blocks: WorkoutBlock[],
  orderedIds: string[],
): WorkoutBlock[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const next: WorkoutBlock[] = [];
  for (const id of orderedIds) {
    const block = byId.get(id);
    if (block) next.push(block);
  }
  // Append any missing (shouldn't happen) to avoid data loss
  for (const block of blocks) {
    if (!orderedIds.includes(block.id)) next.push(block);
  }
  return next;
}
