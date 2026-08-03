import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPersonRunning, faCheck, faForwardStep } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import type { WarmupItem } from '@/types';

interface WarmupPhaseProps {
  warmup: WarmupItem[];
  onComplete: (updatedWarmup: WarmupItem[]) => void;
  onSkipAll: () => void;
}

const TYPE_STYLES: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  cardio:   { label: 'Cardio',   bg: 'bg-[#FF375F]/10',  text: 'text-[#FF375F]',  ring: '#FF375F' },
  stretch:  { label: 'Stretch',  bg: 'bg-[#0A84FF]/10',  text: 'text-[#0A84FF]',  ring: '#0A84FF' },
  mobility: { label: 'Mobility', bg: 'bg-[#BF5AF2]/10',  text: 'text-[#BF5AF2]',  ring: '#BF5AF2' },
};

export function WarmupPhase({ warmup, onComplete, onSkipAll }: WarmupPhaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState<WarmupItem[]>(() =>
    warmup.map((w) => ({ ...w, completed: false, skipped: false })),
  );
  const [timeLeft, setTimeLeft] = useState(warmup[0]?.durationSeconds ?? 60);

  // Keep refs so interval callbacks see latest values
  const currentIndexRef = useRef(0);
  const itemsRef = useRef<WarmupItem[]>(items);
  const onCompleteRef = useRef(onComplete);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalItems = warmup.length;

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Advance to next item, marking current as completed or skipped */
  const advance = useCallback((markCompleted: boolean) => {
    stopTimer();
    const idx = currentIndexRef.current;
    const its = itemsRef.current;
    const updated = its.map((item, i) =>
      i === idx
        ? { ...item, completed: markCompleted, skipped: !markCompleted }
        : item,
    );
    itemsRef.current = updated;
    setItems(updated);

    const nextIdx = idx + 1;
    if (nextIdx < totalItems) {
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      setTimeLeft(its[nextIdx]?.durationSeconds ?? 60);
    } else {
      onCompleteRef.current(updated);
    }
  }, [stopTimer, totalItems]);

  // Start countdown whenever currentIndex changes
  useEffect(() => {
    stopTimer();
    const duration = items[currentIndex]?.durationSeconds ?? 60;
    setTimeLeft(duration);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-advance after timer expires
          setTimeout(() => advance(true), 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const typeStyle = TYPE_STYLES[currentItem.type] ?? TYPE_STYLES.cardio;
  const totalDuration = currentItem.durationSeconds;
  const progressPercent = Math.max(0, Math.min(100, ((totalDuration - timeLeft) / totalDuration) * 100));
  const radius = 72;
  const circumference = 2 * Math.PI * radius;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : String(seconds);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] px-4 pt-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faPersonRunning} className="text-[#FF375F]" />
          <span className="text-sm font-bold text-white">Warmup</span>
        </div>
        <span className="text-sm text-[#8E8E93]">
          {currentIndex + 1} / {totalItems}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[#2c2c2e] rounded-full mb-8 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: typeStyle.ring }}
          animate={{ width: `${(currentIndex / totalItems) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Circular countdown */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.25 }}
          className="flex justify-center mb-8"
        >
          <div className="relative w-44 h-44">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 160 160"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#2c2c2e"
                strokeWidth="8"
              />
              {/* Progress arc */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={typeStyle.ring}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progressPercent / 100)}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white tabular-nums">{timeDisplay}</span>
              <span className="text-xs text-[#8E8E93] mt-1">
                {minutes > 0 ? 'remaining' : 'sec'}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Item name + type */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-3">{currentItem.name}</h2>
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${typeStyle.bg} ${typeStyle.text}`}
          >
            {typeStyle.label}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Instructions */}
      {currentItem.instructions.length > 0 && (
        <div className="bg-[#1c1c1e] rounded-2xl border border-[#38383A] p-4 mb-6">
          <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">Instructions</p>
          <ol className="space-y-2">
            {currentItem.instructions.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className={`font-bold shrink-0 ${typeStyle.text}`}>{i + 1}.</span>
                <span className="text-[#8E8E93]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => advance(false)}
        >
          <FontAwesomeIcon icon={faForwardStep} className="mr-2" />
          Skip
        </Button>
        <Button
          className="flex-[2] bg-[#30D158] hover:bg-[#30D158]/90 text-white border-none"
          onClick={() => advance(true)}
        >
          <FontAwesomeIcon icon={faCheck} className="mr-2" />
          Mark Complete
        </Button>
      </div>

      {/* Skip all warmup */}
      <button
        className="w-full text-center text-sm text-[#8E8E93] hover:text-white transition-colors mt-6 py-2"
        onClick={onSkipAll}
      >
        Skip All Warmup →
      </button>
    </div>
  );
}
