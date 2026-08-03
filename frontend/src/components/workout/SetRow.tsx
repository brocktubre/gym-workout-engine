import { motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkoutSet } from '@/types';

interface SetRowProps {
  set: WorkoutSet;
  onComplete: (weight: number, reps: number) => void;
  onChange: (field: 'weight' | 'reps', value: number) => void;
  isActive?: boolean;
}

export function SetRow({ set, onComplete, onChange, isActive = false }: SetRowProps) {
  const weight = set.completedWeight ?? set.targetWeight ?? 0;
  const reps = set.completedReps ?? set.targetReps;

  const handleComplete = () => {
    if (!set.completed) {
      onComplete(weight, reps);
    }
  };

  return (
    <motion.div
      layout
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-colors duration-200',
        set.completed
          ? 'bg-[#30D158]/10 border border-[#30D158]/20'
          : isActive
          ? 'bg-[#2c2c2e] border border-[#38383A]'
          : 'bg-[#1c1c1e] border border-[#2c2c2e]',
      )}
    >
      {/* Set number */}
      <div className="w-7 h-7 rounded-full bg-[#38383A] flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-[#8E8E93]">{set.setNumber}</span>
      </div>

      {/* Weight control */}
      <div className="flex items-center gap-1.5 flex-1">
        <button
          className="h-7 w-7 rounded-full bg-[#38383A] flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-transform"
          onClick={() => onChange('weight', Math.max(0, weight - 5))}
          disabled={set.completed}
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="text-center min-w-[52px]">
          <input
            type="number"
            className="w-full text-center bg-transparent text-sm font-semibold text-white focus:outline-none disabled:opacity-70"
            value={weight === 0 ? '' : weight}
            placeholder="0"
            min={0}
            step={5}
            disabled={set.completed}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange('weight', v);
            }}
          />
          <div className="text-[10px] text-[#8E8E93]">lbs</div>
        </div>
        <button
          className="h-7 w-7 rounded-full bg-[#38383A] flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-transform"
          onClick={() => onChange('weight', weight + 5)}
          disabled={set.completed}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="text-[#38383A] text-sm">×</div>

      {/* Reps control */}
      <div className="flex items-center gap-1.5 flex-1">
        <button
          className="h-7 w-7 rounded-full bg-[#38383A] flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-transform"
          onClick={() => onChange('reps', Math.max(1, reps - 1))}
          disabled={set.completed}
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="text-center min-w-[40px]">
          <input
            type="number"
            className="w-full text-center bg-transparent text-sm font-semibold text-white focus:outline-none disabled:opacity-70"
            value={reps}
            min={1}
            disabled={set.completed}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) onChange('reps', v);
            }}
          />
          <div className="text-[10px] text-[#8E8E93]">reps</div>
        </div>
        <button
          className="h-7 w-7 rounded-full bg-[#38383A] flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-transform"
          onClick={() => onChange('reps', reps + 1)}
          disabled={set.completed}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Done button */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={handleComplete}
        className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200',
          set.completed
            ? 'bg-[#30D158] text-white'
            : 'bg-[#38383A] text-[#8E8E93] hover:bg-[#FF375F] hover:text-white',
        )}
      >
        <motion.div
          animate={set.completed ? { scale: [0.5, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Check className="h-4 w-4" />
        </motion.div>
      </motion.button>
    </motion.div>
  );
}
