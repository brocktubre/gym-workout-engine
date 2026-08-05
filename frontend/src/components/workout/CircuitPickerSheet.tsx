import { Check, Flame, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { WARMUP_CIRCUIT_INDEX, type Circuit } from '@/lib/workoutCircuits';

interface CircuitPickerSheetProps {
  open: boolean;
  circuits: Circuit[];
  currentIndex: number;
  hasWarmup: boolean;
  warmupComplete: boolean;
  onSelect: (circuitIndex: number) => void;
  onClose: () => void;
}

interface RowProps {
  title: string;
  subtitle: string;
  position: string;
  isCurrent: boolean;
  isComplete: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}

function CircuitRow({ title, subtitle, position, isCurrent, isComplete, icon, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-colors',
        isCurrent
          ? 'bg-[#FF375F]/10 border-[#FF375F]/40'
          : 'bg-[#2c2c2e] border-[#38383A] hover:bg-[#3a3a3c]',
      )}
    >
      <div
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
          isComplete
            ? 'bg-[#30D158]/20 text-[#30D158]'
            : isCurrent
            ? 'bg-[#FF375F] text-white'
            : 'bg-[#38383A] text-[#8E8E93]',
        )}
      >
        {isComplete ? <Check className="h-4 w-4" /> : icon ?? position}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold truncate', isCurrent ? 'text-white' : 'text-white/90')}>
          {title}
        </p>
        <p className="text-xs text-[#8E8E93] truncate">{subtitle}</p>
      </div>

      {isCurrent && <Play className="h-3.5 w-3.5 text-[#FF375F] fill-[#FF375F] flex-shrink-0" />}
    </button>
  );
}

export function CircuitPickerSheet({
  open,
  circuits,
  currentIndex,
  hasWarmup,
  warmupComplete,
  onSelect,
  onClose,
}: CircuitPickerSheetProps) {
  const handleSelect = (index: number) => {
    onSelect(index);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden bg-[#1c1c1e] border-[#38383A]">
        <DialogHeader className="px-4 pt-5 pb-3 border-b border-[#38383A] flex-shrink-0">
          <DialogTitle className="text-white text-base">Jump to Circuit</DialogTitle>
          <DialogDescription className="text-[#8E8E93] text-sm">
            Pick any part of the workout — your completed sets are kept
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {hasWarmup && (
            <CircuitRow
              title="Warmup"
              subtitle={warmupComplete ? 'Completed' : 'Not finished'}
              position="W"
              icon={<Flame className="h-4 w-4" />}
              isCurrent={currentIndex === WARMUP_CIRCUIT_INDEX}
              isComplete={warmupComplete}
              onClick={() => handleSelect(WARMUP_CIRCUIT_INDEX)}
            />
          )}

          {circuits.map((circuit, i) => {
            const isComplete = circuit.completedSets >= circuit.totalSets;
            const subtitle =
              circuit.kind === 'superset'
                ? `${circuit.memberNames.join(' + ')} · ${circuit.completedSets}/${circuit.totalSets} sets`
                : `${circuit.completedSets}/${circuit.totalSets} sets`;

            return (
              <CircuitRow
                key={circuit.key}
                title={circuit.kind === 'superset' ? circuit.label : circuit.memberNames[0]}
                subtitle={subtitle}
                position={String(i + 1)}
                isCurrent={i === currentIndex}
                isComplete={isComplete}
                onClick={() => handleSelect(i)}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
