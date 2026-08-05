import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Info, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { MuscleGroupBadge } from './MuscleGroupBadge';
import { ExerciseVideoButton } from './ExerciseVideoButton';
import { cn } from '@/lib/utils';
import type { WorkoutExercise } from '@/types';

interface ExerciseItemProps {
  workoutExercise: WorkoutExercise;
  index?: number;
  showProgress?: boolean;
  /** Total number of exercises sharing this superset group (2, 3, or 4) */
  supersetMemberCount?: number;
  /** When provided, shows a swap button and calls this on tap */
  onSwap?: () => void;
}

/** Derive the superset type label from member count */
function supersetLabel(count: number) {
  if (count === 3) return 'Tri-Set';
  if (count >= 4) return 'Giant Set';
  return 'Superset';
}

export function ExerciseItem({ workoutExercise, index, showProgress = false, supersetMemberCount, onSwap }: ExerciseItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { exercise, sets, progressionNote, supersetGroupId, supersetOrder } = workoutExercise;

  const completedSets = sets.filter((s) => s.completed).length;
  const totalSets = sets.length;
  const isFullyDone = completedSets === totalSets && totalSets > 0;
  const memberCount = supersetMemberCount ?? 2;
  // Letter for this exercise in the superset: A, B, C, D
  const supersetLetter = supersetGroupId && supersetOrder
    ? String.fromCharCode(64 + supersetOrder)
    : '';

  return (
    <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] overflow-hidden">
      {/* Superset / Tri-Set / Giant Set badge — shown for ALL positions (A, B, C, D) */}
      {supersetGroupId && supersetOrder !== undefined && (
        <div className="px-4 pt-3 pb-0">
          {supersetOrder === 1 ? (
            // First member: show type name + full sequence  A → B → C ...
            <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-[#0A84FF]/10 rounded-lg border border-[#0A84FF]/20 w-fit">
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[#0A84FF] text-xs" />
              <span className="text-xs font-bold text-[#0A84FF] uppercase tracking-wider">
                {supersetLabel(memberCount)}
              </span>
              {/* Sequence pills A → B → C → D */}
              <div className="flex items-center gap-0.5 ml-1">
                {Array.from({ length: memberCount }, (_, i) => (
                  <span key={i} className="text-[10px] font-bold text-[#0A84FF]/80">
                    {i > 0 && <span className="text-[#0A84FF]/40 mx-0.5">→</span>}
                    {String.fromCharCode(65 + i)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            // Subsequent members (B, C, D): show their letter
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-[#0A84FF]/5 rounded-lg border border-[#0A84FF]/10 w-fit">
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-[#0A84FF]/60 text-xs" />
              <span className="text-xs text-[#0A84FF]/70 font-bold tracking-wider">
                ↳ {supersetLetter}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main row */}
      <div className="flex items-start justify-between gap-2 p-4">
          <button
            type="button"
            className="flex items-start flex-1 min-w-0 text-left"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {index !== undefined && (
                  <span className="text-xs font-bold text-[#8E8E93]">
                    #{index + 1}
                  </span>
                )}
                <span className={cn('font-semibold text-sm', isFullyDone && showProgress ? 'text-[#30D158]' : 'text-white')}>
                  {exercise.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <MuscleGroupBadge muscle={exercise.primaryMuscle} size="sm" />
                <span className="text-[#8E8E93] text-xs">
                  {totalSets} × 
                  {sets[0]?.targetHoldSeconds !== undefined
                    ? `Hold ${sets[0].targetHoldSeconds}s`
                    : `${sets[0]?.targetReps ?? '?'} reps${sets[0]?.targetWeight ? ` @ ${sets[0].targetWeight}lbs` : ''}`}
                </span>
              </div>
              {progressionNote && (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-[#30D158]" />
                  <span className="text-[#30D158] text-xs">{progressionNote}</span>
                </div>
              )}
            </div>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showProgress && (
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                isFullyDone
                  ? 'bg-[#30D158]/20 text-[#30D158]'
                  : completedSets > 0
                  ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
                  : 'bg-[#38383A] text-[#8E8E93]',
              )}>
                {completedSets}/{totalSets}
              </span>
            )}
            <ExerciseVideoButton
              name={exercise.name}
              exerciseId={exercise.id}
              className="h-7 w-7 rounded-lg"
            />
            {onSwap && (
              <button
                type="button"
                onClick={onSwap}
                className="h-7 w-7 rounded-lg bg-[#2c2c2e] flex items-center justify-center text-[#8E8E93] hover:text-[#FF375F] hover:bg-[#FF375F]/10 transition-colors"
                title="Swap exercise"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center justify-center text-[#8E8E93]"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
      </div>

      {/* Expanded instructions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[#38383A] pt-3 space-y-3">
              {exercise.instructions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Info className="h-3.5 w-3.5 text-[#0A84FF]" />
                    <span className="text-xs font-semibold text-[#0A84FF]">Instructions</span>
                  </div>
                  <ol className="space-y-1">
                    {exercise.instructions.map((step, i) => (
                      <li key={i} className="text-xs text-[#8E8E93] flex gap-2">
                        <span className="text-[#FF375F] font-medium shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {exercise.tips.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-semibold text-[#FF9F0A]">💡 Tips</span>
                  </div>
                  <ul className="space-y-1">
                    {exercise.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-[#8E8E93] flex gap-2">
                        <span className="text-[#FF9F0A] shrink-0">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {exercise.secondaryMuscles.length > 0 && (
                <div>
                  <span className="text-xs text-[#8E8E93]">Also works: </span>
                  <div className="inline-flex flex-wrap gap-1 mt-1">
                    {exercise.secondaryMuscles.map((m) => (
                      <MuscleGroupBadge key={m} muscle={m} size="sm" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
