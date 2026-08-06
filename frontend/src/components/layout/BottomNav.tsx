import { NavLink, useLocation } from 'react-router-dom';
import { Home, Zap, Play, Calendar, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useActiveWorkout } from '@/hooks/useWorkoutEngine';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  conditional?: boolean;
}

export function BottomNav() {
  const { hasActiveWorkout } = useActiveWorkout();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      to: '/',
      icon: <Home className="h-5 w-5" />,
      label: 'Home',
    },
    {
      to: '/generate',
      icon: <Zap className="h-5 w-5" />,
      label: 'Workout',
    },
    {
      to: '/active',
      icon: <Play className="h-5 w-5" />,
      label: 'Active',
      conditional: true,
    },
    {
      to: '/history',
      icon: <Calendar className="h-5 w-5" />,
      label: 'History',
    },
    {
      to: '/settings',
      icon: <Settings className="h-5 w-5" />,
      label: 'Settings',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#38383A]">
      <div
        className="flex items-center justify-around px-2"
        style={{ height: '83px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {navItems.map((item) => {
          // Hide conditional nav items when not relevant
          if (item.conditional && !hasActiveWorkout) {
            return null;
          }

          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center flex-1 relative py-2 gap-1"
            >
              <div className="relative">
                <motion.div
                  className={cn(
                    'transition-colors duration-150',
                    isActive ? 'text-[#FF375F]' : 'text-[#8E8E93]',
                  )}
                  whileTap={{ scale: 0.85 }}
                >
                  {item.icon}
                </motion.div>
                {/* Red dot for active workout indicator */}
                {item.conditional && hasActiveWorkout && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FF375F]">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#FF375F] opacity-75" />
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors duration-150',
                  isActive ? 'text-[#FF375F]' : 'text-[#8E8E93]',
                )}
              >
                {item.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF375F]"
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
