import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BottomNav } from './BottomNav';

// AnimatePresence mode="wait" was removed — it held the exiting page until its
// exit animation finished before mounting the new page, leaving a black-screen
// gap whenever nested AnimatePresence trees (e.g. ActiveWorkout) stalled the
// exit. Without AnimatePresence, React swaps pages immediately; the new page
// still fades in smoothly with the enter animation below.
export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="min-h-screen pb-[100px]"
      >
        <Outlet />
      </motion.main>
      <BottomNav />
    </div>
  );
}
