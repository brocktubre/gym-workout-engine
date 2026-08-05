/**
 * Gym inventory constraints for suggested loads.
 * Claude (and the rule engine) must never prescribe outside these lists.
 */

export const AVAILABLE_DUMBBELL_WEIGHTS = [10, 15, 20, 35, 50] as const;

/** Common kettlebells available in this gym — keep in sync with real inventory. */
export const AVAILABLE_KETTLEBELL_WEIGHTS = [18, 26, 35, 44, 53] as const;

function snapToList(weight: number, options: readonly number[]): number {
  let best = options[0];
  let bestDist = Math.abs(weight - best);
  for (const option of options) {
    const dist = Math.abs(weight - option);
    if (dist < bestDist || (dist === bestDist && option > best)) {
      best = option;
      bestDist = dist;
    }
  }
  return best;
}

export function snapToAvailableDumbbell(weight: number): number {
  return snapToList(weight, AVAILABLE_DUMBBELL_WEIGHTS);
}

export function snapToAvailableKettlebell(weight: number): number {
  return snapToList(weight, AVAILABLE_KETTLEBELL_WEIGHTS);
}

export function nextDumbbellWeight(weight: number): number {
  for (const option of AVAILABLE_DUMBBELL_WEIGHTS) {
    if (option > weight) return option;
  }
  return AVAILABLE_DUMBBELL_WEIGHTS[AVAILABLE_DUMBBELL_WEIGHTS.length - 1];
}

export function nextKettlebellWeight(weight: number): number {
  for (const option of AVAILABLE_KETTLEBELL_WEIGHTS) {
    if (option > weight) return option;
  }
  return AVAILABLE_KETTLEBELL_WEIGHTS[AVAILABLE_KETTLEBELL_WEIGHTS.length - 1];
}

/** Clamp a suggested load to the plates/bells that actually exist for that equipment. */
export function snapSuggestedWeight(equipment: string, weight: number): number {
  if (equipment === 'dumbbell') return snapToAvailableDumbbell(weight);
  if (equipment === 'kettlebell') return snapToAvailableKettlebell(weight);
  // Barbell / machine / cable / etc. — round to nearest 5 lbs
  return Math.max(0, Math.round(weight / 5) * 5);
}
