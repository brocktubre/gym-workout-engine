import { cn, muscleGroupColor, capitalizeFirst } from '@/lib/utils';
import type { MuscleGroup } from '@/types';

interface MuscleGroupBadgeProps {
  muscle: MuscleGroup | string;
  className?: string;
  size?: 'sm' | 'default';
}

export function MuscleGroupBadge({ muscle, className, size = 'default' }: MuscleGroupBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        muscleGroupColor(muscle),
        className,
      )}
    >
      {capitalizeFirst(muscle)}
    </span>
  );
}
