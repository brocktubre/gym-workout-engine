import type { MuscleGroup } from '../types';

/**
 * Deterministic muscle-group rotations keyed by local calendar date.
 * Same date always yields the same focus so the daily workout stays stable.
 */
const DAILY_MUSCLE_ROTATIONS: MuscleGroup[][] = [
  ['chest', 'triceps', 'shoulders'],
  ['back', 'biceps'],
  ['quads', 'hamstrings', 'glutes'],
  ['shoulders', 'back', 'core'],
  ['chest', 'back'],
  ['quads', 'glutes', 'calves'],
  ['biceps', 'triceps', 'shoulders'],
];

/** Stable day index from YYYY-MM-DD (UTC noon avoids DST edge cases). */
function dayIndexFromLocalDate(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d, 12) / 86_400_000);
}

export function musclesForLocalDate(localDate: string): MuscleGroup[] {
  const idx = dayIndexFromLocalDate(localDate);
  return DAILY_MUSCLE_ROTATIONS[Math.abs(idx) % DAILY_MUSCLE_ROTATIONS.length];
}
