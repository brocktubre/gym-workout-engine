import type { WorkoutExercise } from '@/types';

/**
 * A circuit is one card in the active workout: a single movement or a whole
 * superset group. The warmup is treated as a circuit by the UI but isn't
 * derived here, since it has no sets.
 */
export interface Circuit {
  key: string;
  kind: 'superset' | 'single';
  /** "Bench Press" or "Superset" / "Tri-Set" / "Giant Set" */
  label: string;
  memberNames: string[];
  /** Indexes into the turn list, in the order they're performed */
  turnIndexes: number[];
  totalSets: number;
  completedSets: number;
}

/** Minimal shape of a turn — structurally compatible with WorkoutTurn. */
export interface CircuitTurn {
  exerciseIndex: number;
  setIndex: number;
  supersetGroupId?: string;
}

export const WARMUP_CIRCUIT_INDEX = -1;

function groupLabel(memberCount: number): string {
  if (memberCount === 3) return 'Tri-Set';
  if (memberCount >= 4) return 'Giant Set';
  return 'Superset';
}

/**
 * Collapse the flat turn list into circuits. Turns for a superset group and for
 * a single movement are always contiguous, so consecutive grouping is enough.
 */
export function buildCircuits(
  exercises: WorkoutExercise[],
  turns: CircuitTurn[],
): Circuit[] {
  const circuits: Circuit[] = [];
  let currentKey: string | null = null;

  turns.forEach((turn, turnIndex) => {
    const key = turn.supersetGroupId ?? `exercise:${turn.exerciseIndex}`;

    if (key !== currentKey) {
      currentKey = key;
      const memberNames = turn.supersetGroupId
        ? exercises
            .filter((e) => e.supersetGroupId === turn.supersetGroupId)
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
            .map((e) => e.exercise.name)
        : [exercises[turn.exerciseIndex]?.exercise.name ?? 'Movement'];

      circuits.push({
        key,
        kind: turn.supersetGroupId ? 'superset' : 'single',
        label: turn.supersetGroupId ? groupLabel(memberNames.length) : memberNames[0],
        memberNames,
        turnIndexes: [],
        totalSets: 0,
        completedSets: 0,
      });
    }

    const circuit = circuits[circuits.length - 1];
    circuit.turnIndexes.push(turnIndex);
    circuit.totalSets += 1;
    if (exercises[turn.exerciseIndex]?.sets[turn.setIndex]?.completed) {
      circuit.completedSets += 1;
    }
  });

  return circuits;
}

/** Which circuit a given turn belongs to; 0 when nothing matches. */
export function circuitIndexForTurn(circuits: Circuit[], turnIndex: number): number {
  const found = circuits.findIndex((c) => c.turnIndexes.includes(turnIndex));
  return found === -1 ? 0 : found;
}

/**
 * Where to land when jumping into a circuit — the first set still to be done,
 * falling back to the start so a finished circuit can still be revisited.
 */
export function entryTurnForCircuit(
  circuit: Circuit,
  turns: CircuitTurn[],
  exercises: WorkoutExercise[],
): number {
  const unfinished = circuit.turnIndexes.find((ti) => {
    const turn = turns[ti];
    return turn && !exercises[turn.exerciseIndex]?.sets[turn.setIndex]?.completed;
  });
  return unfinished ?? circuit.turnIndexes[0] ?? 0;
}
