import { motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkoutSet } from '@/types';

// Equipment types that never use external weight
const NO_WEIGHT_EQUIPMENT = new Set([
  'bodyweight', 'rings', 'pull-up-bar', 'battle-rope',
  'echo-bike', 'rower', 'ski-erg', 'plyometric-box',
]);

interface SetRowProps {
  set: WorkoutSet;
  onComplete: (weight: number, reps: number) => void;
  onChange: (field: 'weight' | 'reps', value: number) => void;
  isActive?: boolean;
  /** Equipment type — hides lbs adjuster when no external weight is used */
  equipment?: string;
}

export function SetRow({ set, onComplete, onChange, isActive = false, equipment }: SetRowProps) {
  const weight = set.completedWeight ?? set.targetWeight ?? 0;
  const reps = set.completedReps ?? set.targetReps;
  const showWeight = !equipment || !NO_WEIGHT_EQUIPMENT.has(equipment);

  const handleComplete = () => {
    if (!set.completed) {
      onComplete(weight, reps);
    }
  };

  // ── Completed set — compact single row ─────────────────────────────────────
  if (set.completed) {
    return (
      <motion.div
        layout
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#30D158]/10 border border-[#30D158]/20"
      >
        <div className="w-7 h-7 rounded-full bg-[#30D158]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#30D158]">{set.setNumber}</span>
        </div>
        <div className="flex-1 text-sm font-medium text-white">
          {showWeight && weight > 0 ? `${weight} lbs × ` : ''}
          {set.completedReps ?? set.targetReps} reps
        </div>
        <div className="h-8 w-8 rounded-full bg-[#30D158] flex items-center justify-center flex-shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
      </motion.div>
    );
  }

  // ── Active set — expanded mobile-friendly layout ────────────────────────────
  if (isActive) {
    return (
      <motion.div
        layout
        className="p-3 rounded-xl bg-[#2c2c2e] border border-[#38383A]"
      >
        {/* Set label + target hint */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[#8E8E93] uppercase tracking-wide">
            Set {set.setNumber}
          </span>
          {set.targetReps > 0 && (
            <span className="text-xs text-[#48484A]">
              Target: {set.targetReps} reps
              {showWeight && set.targetWeight && set.targetWeight > 0
                ? ` · ${set.targetWeight} lbs`
                : ''}
            </span>
          )}
        </div>

        {/* Weight + Reps adjusters — 2-col grid when weight shown, single col otherwise */}
        <div className={cn('mb-3', showWeight ? 'grid grid-cols-2 gap-3' : '')}>
          {showWeight && (
            <div className="bg-[#1c1c1e] rounded-xl p-2.5">
              <p className="text-[10px] text-[#8E8E93] uppercase tracking-wide text-center mb-2">
                Weight
              </p>
              <div className="flex items-center gap-1">
                <button
                  className="h-10 w-10 rounded-xl bg-[#38383A] flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation flex-shrink-0"
                  onClick={() => onChange('weight', Math.max(0, weight - 5))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    className="w-full text-center bg-transparent text-base font-bold text-white focus:outline-none"
                    value={weight === 0 ? '' : weight}
                    placeholder="0"
                    min={0}
                    step={5}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) onChange('weight', v);
                    }}
                  />
                  <div className="text-[10px] text-[#8E8E93]">lbs</div>
                </div>
                <button
                  className="h-10 w-10 rounded-xl bg-[#38383A] flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation flex-shrink-0"
                  onClick={() => onChange('weight', weight + 5)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-[#1c1c1e] rounded-xl p-2.5">
            <p className="text-[10px] text-[#8E8E93] uppercase tracking-wide text-center mb-2">
              Reps
            </p>
            <div className="flex items-center gap-1">
              <button
                className="h-10 w-10 rounded-xl bg-[#38383A] flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation flex-shrink-0"
                onClick={() => onChange('reps', Math.max(1, reps - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  className="w-full text-center bg-transparent text-base font-bold text-white focus:outline-none"
                  value={reps}
                  min={1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) onChange('reps', v);
                  }}
                />
                <div className="text-[10px] text-[#8E8E93]">reps</div>
              </div>
              <button
                className="h-10 w-10 rounded-xl bg-[#38383A] flex items-center justify-center text-white active:scale-90 transition-transform touch-manipulation flex-shrink-0"
                onClick={() => onChange('reps', reps + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Full-width complete button */}
        <button
          type="button"
          onClick={handleComplete}
          className={cn(
            'w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm',
            'transition-colors duration-150 touch-manipulation select-none',
            'bg-[#38383A] text-[#8E8E93] hover:bg-[#30D158]/20 hover:text-[#30D158]',
            'active:bg-[#30D158] active:text-white',
          )}
        >
          <Check className="h-5 w-5" />
          Mark Complete
        </button>
      </motion.div>
    );
  }

  // ── Upcoming / pending set — compact row ────────────────────────────────────
  return (
    <motion.div
      layout
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1c1c1e] border border-[#2c2c2e]"
    >
      <div className="w-7 h-7 rounded-full bg-[#38383A] flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-[#8E8E93]">{set.setNumber}</span>
      </div>
      <div className="flex-1 text-sm text-[#48484A]">
        {showWeight && set.targetWeight && set.targetWeight > 0
          ? `${set.targetWeight} lbs × `
          : ''}
        {set.targetReps} reps
      </div>
      {/* Tap to complete with target values */}
      <button
        type="button"
        onClick={handleComplete}
        className="h-8 w-8 rounded-full bg-[#38383A]/50 flex items-center justify-center flex-shrink-0 touch-manipulation active:bg-[#30D158] active:text-white text-[#8E8E93]/40 transition-colors"
      >
        <Check className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
