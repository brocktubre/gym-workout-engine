import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { formatElapsedTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Web Audio sounds — no external files, no deps
// ---------------------------------------------------------------------------
function playBeep(frequency: number, durationSec: number, volume = 0.35) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationSec);
    osc.onended = () => { ctx.close(); };
  } catch { /* blocked in some environments */ }
}

// Bell-like DING: fundamental + overtone, slow decay
function playDing() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    const freqs = [660, 1320]; // fundamental + octave overtone
    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.start(t);
      osc.stop(t + 1.2);
      osc.onended = () => { ctx.close(); };
    });
  } catch { /* blocked in some environments */ }
}

interface WorkoutTimerProps {
  elapsed: number;
  size?: 'sm' | 'default' | 'lg';
}

export function WorkoutTimer({ elapsed, size = 'default' }: WorkoutTimerProps) {
  const fontClass = {
    sm: 'text-2xl',
    default: 'text-4xl',
    lg: 'text-6xl',
  }[size];

  return (
    <div className="flex flex-col items-center">
      <motion.span
        key={Math.floor(elapsed / 60)}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        className={`${fontClass} font-bold tabular-nums text-white tracking-tight`}
      >
        {formatElapsedTime(elapsed)}
      </motion.span>
      <span className="text-xs text-[#8E8E93] mt-1">elapsed</span>
    </div>
  );
}

interface RestTimerProps {
  seconds: number;
  totalSeconds: number;
  onSkip: () => void;
}

export function RestTimer({ seconds, totalSeconds, onSkip }: RestTimerProps) {
  // beep beep beep DING countdown
  useEffect(() => {
    if (seconds === 3 || seconds === 2 || seconds === 1) {
      playBeep(880, 0.12);   // short high beep
    } else if (seconds === 0) {
      playDing();            // bell-like DING — go!
    }
  }, [seconds]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / totalSeconds;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <div className="relative h-24 w-24">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
          {/* Background circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-[#2c2c2e]"
            strokeWidth="6"
            fill="none"
          />
          {/* Progress arc */}
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            stroke="#0A84FF"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-white">{seconds}</span>
          <span className="text-[10px] text-[#8E8E93]">rest</span>
        </div>
      </div>
      <button
        onClick={onSkip}
        className="text-xs text-[#8E8E93] hover:text-white transition-colors px-3 py-1"
      >
        Skip rest
      </button>
    </motion.div>
  );
}
