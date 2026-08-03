import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire } from '@fortawesome/free-solid-svg-icons';
import { motion } from 'framer-motion';

interface StreakDisplayProps {
  streak: number;
  longestStreak?: number;
}

export function StreakDisplay({ streak, longestStreak }: StreakDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Outer glow ring */}
        {streak > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,55,95,0.3) 0%, transparent 70%)',
              scale: 1.4,
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-[#FF375F] to-[#FF9F0A] flex items-center justify-center shadow-lg shadow-[#FF375F]/30">
          <div className="text-center">
            <div className="text-2xl font-black text-white leading-none">{streak}</div>
          </div>
        </div>
      </div>
      <div className="text-lg mt-1 text-[#FF375F]"><FontAwesomeIcon icon={faFire} /></div>
      <p className="text-xs text-[#8E8E93] mt-0.5">
        {streak === 1 ? '1 day streak' : `${streak} day streak`}
      </p>
      {longestStreak !== undefined && longestStreak > 0 && (
        <p className="text-[10px] text-[#8E8E93]/60 mt-0.5">
          Best: {longestStreak} days
        </p>
      )}
    </div>
  );
}
