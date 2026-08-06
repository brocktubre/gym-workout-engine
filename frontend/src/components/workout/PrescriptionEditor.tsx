import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { WorkoutSet } from '@/types';

const NO_WEIGHT_EQUIPMENT = new Set([
  'bodyweight', 'rings', 'pull-up-bar', 'battle-rope',
  'echo-bike', 'rower', 'ski-erg', 'plyometric-box',
]);

const MIN_SETS = 1;
const MAX_SETS = 10;
const MIN_REPS = 1;
const MAX_REPS = 25;
const MIN_SECONDS = 5;
const MAX_SECONDS = 600;
const MIN_WEIGHT = 0;
const MAX_WEIGHT = 500;

interface PrescriptionEditorProps {
  sets: WorkoutSet[];
  equipment?: string;
  onChange: (sets: WorkoutSet[]) => void;
  /** Called after a successful Save so the parent can collapse the editor */
  onSaved?: () => void;
}

/** Rebuild sets with a new count, copying targets from the template. */
function rebuildSets(template: WorkoutSet, count: number): WorkoutSet[] {
  return Array.from({ length: count }, (_, i) => ({
    ...template,
    setNumber: i + 1,
    completed: false,
    completedReps: undefined,
    completedWeight: undefined,
    completedHoldSeconds: undefined,
    completedDurationSeconds: undefined,
  }));
}

function Field({
  label,
  value,
  onChange,
  suffix,
  maxLength,
  className,
}: {
  label?: string;
  value: string;
  onChange: (digits: string) => void;
  suffix?: string;
  maxLength: number;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className ?? 'flex-1'}`}>
      {label && (
        <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))}
          className="w-full h-9 rounded-lg bg-[#0a0a0a] border border-[#38383A] px-2.5 text-sm font-bold text-white tabular-nums focus:outline-none focus:border-[#FF375F]/60"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#636366]">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

interface PerSetDraft {
  reps: string;
  weight: string;
}

/**
 * Compact typed editor for pre-workout targets.
 * Weighted movements: one row per set (reps + weight).
 * Holds / timed / bodyweight: single sets editor.
 */
export function PrescriptionEditor({
  sets,
  equipment,
  onChange,
  onSaved,
}: PrescriptionEditorProps) {
  const first = sets[0];
  const isHold = first?.targetHoldSeconds !== undefined;
  const isTimed = first?.targetDurationSeconds !== undefined;
  const showWeight = Boolean(
    first && !isHold && !isTimed && (!equipment || !NO_WEIGHT_EQUIPMENT.has(equipment)),
  );
  /** Per-set rows for loaded movements; compact set-count editor otherwise */
  const perSetMode = showWeight;

  const [setsDraft, setSetsDraft] = useState(String(sets.length || 1));
  const [repsDraft, setRepsDraft] = useState(String(first?.targetReps ?? 10));
  const [holdDraft, setHoldDraft] = useState(String(first?.targetHoldSeconds ?? 30));
  const [durationDraft, setDurationDraft] = useState(String(first?.targetDurationSeconds ?? 30));
  const [rowDrafts, setRowDrafts] = useState<PerSetDraft[]>(() =>
    sets.map((s) => ({
      reps: String(s.targetReps ?? 10),
      weight: s.targetWeight !== undefined && s.targetWeight > 0 ? String(s.targetWeight) : '',
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const setsSignature = sets
    .map((s) => `${s.targetReps}:${s.targetWeight ?? ''}:${s.targetHoldSeconds ?? ''}:${s.targetDurationSeconds ?? ''}`)
    .join('|');

  useEffect(() => {
    if (!first) return;
    setSetsDraft(String(sets.length));
    setRepsDraft(String(first.targetReps));
    setHoldDraft(String(first.targetHoldSeconds ?? 30));
    setDurationDraft(String(first.targetDurationSeconds ?? 30));
    setRowDrafts(
      sets.map((s) => ({
        reps: String(s.targetReps ?? 10),
        weight: s.targetWeight !== undefined && s.targetWeight > 0 ? String(s.targetWeight) : '',
      })),
    );
    setError(null);
  // Reset only when saved prescription content changes — not on every parent render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsSignature, sets.length]);

  if (!first || sets.length === 0) return null;

  const updateRow = (index: number, patch: Partial<PerSetDraft>) => {
    setRowDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSavePerSet = () => {
    const nextSets: WorkoutSet[] = [];
    for (let i = 0; i < rowDrafts.length; i++) {
      const draft = rowDrafts[i];
      const template = sets[i] ?? first;
      const reps = parseInt(draft.reps, 10);
      if (!Number.isFinite(reps) || draft.reps.trim() === '') {
        setError(`Set ${i + 1}: enter reps (${MIN_REPS}–${MAX_REPS})`);
        return;
      }
      if (reps < MIN_REPS || reps > MAX_REPS) {
        setError(`Set ${i + 1}: reps must be between ${MIN_REPS} and ${MAX_REPS}`);
        return;
      }

      let weight = 0;
      if (draft.weight.trim() !== '') {
        weight = parseInt(draft.weight, 10);
        if (!Number.isFinite(weight)) {
          setError(`Set ${i + 1}: enter weight (0–${MAX_WEIGHT} lbs)`);
          return;
        }
        if (weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
          setError(`Set ${i + 1}: weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} lbs`);
          return;
        }
      }

      nextSets.push({
        ...template,
        setNumber: i + 1,
        targetReps: reps,
        targetWeight: weight > 0 ? weight : undefined,
        completed: false,
        completedReps: undefined,
        completedWeight: undefined,
        completedHoldSeconds: undefined,
        completedDurationSeconds: undefined,
      });
    }

    setError(null);
    onChange(nextSets);
    onSaved?.();
  };

  const handleSaveCompact = () => {
    const setCount = parseInt(setsDraft, 10);
    if (!Number.isFinite(setCount) || setsDraft.trim() === '') {
      setError(`Enter sets (${MIN_SETS}–${MAX_SETS})`);
      return;
    }
    if (setCount < MIN_SETS || setCount > MAX_SETS) {
      setError(`Sets must be between ${MIN_SETS} and ${MAX_SETS}`);
      return;
    }

    const patch: Partial<WorkoutSet> = {};

    if (isHold) {
      const hold = parseInt(holdDraft, 10);
      if (!Number.isFinite(hold) || holdDraft.trim() === '') {
        setError(`Enter hold time (${MIN_SECONDS}–${MAX_SECONDS}s)`);
        return;
      }
      if (hold < MIN_SECONDS || hold > MAX_SECONDS) {
        setError(`Hold must be between ${MIN_SECONDS} and ${MAX_SECONDS} seconds`);
        return;
      }
      patch.targetHoldSeconds = hold;
      patch.targetReps = 1;
    } else if (isTimed) {
      const duration = parseInt(durationDraft, 10);
      if (!Number.isFinite(duration) || durationDraft.trim() === '') {
        setError(`Enter time (${MIN_SECONDS}–${MAX_SECONDS}s)`);
        return;
      }
      if (duration < MIN_SECONDS || duration > MAX_SECONDS) {
        setError(`Time must be between ${MIN_SECONDS} and ${MAX_SECONDS} seconds`);
        return;
      }
      patch.targetDurationSeconds = duration;
      patch.targetReps = 1;
    } else {
      const reps = parseInt(repsDraft, 10);
      if (!Number.isFinite(reps) || repsDraft.trim() === '') {
        setError(`Enter reps (${MIN_REPS}–${MAX_REPS})`);
        return;
      }
      if (reps < MIN_REPS || reps > MAX_REPS) {
        setError(`Reps must be between ${MIN_REPS} and ${MAX_REPS}`);
        return;
      }
      patch.targetReps = reps;
    }

    setError(null);
    onChange(rebuildSets({ ...first, ...patch }, setCount));
    onSaved?.();
  };

  return (
    <div
      className="px-4 pb-3 pt-1 space-y-2 border-t border-[#38383A]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {perSetMode ? (
        <>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider px-0.5">
            <span className="w-10">Set</span>
            <span className="flex-1">Reps</span>
            <span className="flex-1">Weight</span>
          </div>
          <div className="space-y-1.5">
            {rowDrafts.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 text-xs font-bold text-[#636366] tabular-nums text-center">
                  {i + 1}
                </span>
                <Field
                  value={row.reps}
                  onChange={(v) => updateRow(i, { reps: v })}
                  maxLength={2}
                />
                <Field
                  value={row.weight}
                  onChange={(v) => updateRow(i, { weight: v })}
                  suffix="lbs"
                  maxLength={3}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-[#636366]">
              Reps {MIN_REPS}–{MAX_REPS} · Weight 0–{MAX_WEIGHT} lbs
            </p>
            <button
              type="button"
              onClick={handleSavePerSet}
              className="h-9 px-3 rounded-lg bg-[#FF375F] text-white text-xs font-semibold flex items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <Field
              label="Sets"
              value={setsDraft}
              onChange={setSetsDraft}
              maxLength={2}
            />
            {isHold ? (
              <Field
                label="Hold"
                value={holdDraft}
                onChange={setHoldDraft}
                suffix="s"
                maxLength={3}
              />
            ) : isTimed ? (
              <Field
                label="Time"
                value={durationDraft}
                onChange={setDurationDraft}
                suffix="s"
                maxLength={3}
              />
            ) : (
              <Field
                label="Reps"
                value={repsDraft}
                onChange={setRepsDraft}
                maxLength={2}
              />
            )}
            <button
              type="button"
              onClick={handleSaveCompact}
              className="h-9 px-3 rounded-lg bg-[#FF375F] text-white text-xs font-semibold flex items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
          <p className="text-[10px] text-[#636366]">
            Sets {MIN_SETS}–{MAX_SETS}
            {!isHold && !isTimed ? ` · Reps ${MIN_REPS}–${MAX_REPS}` : ''}
            {(isHold || isTimed) ? ` · Seconds ${MIN_SECONDS}–${MAX_SECONDS}` : ''}
          </p>
        </>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
