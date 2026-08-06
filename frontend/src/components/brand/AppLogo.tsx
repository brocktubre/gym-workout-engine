import { cn } from '@/lib/utils';

const SIZE_CLASS = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
} as const;

export type AppLogoSize = keyof typeof SIZE_CLASS;

interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
  /** Optional product name under / beside the mark */
  wordmark?: boolean;
  wordmarkClassName?: string;
  /** Layout when wordmark is shown */
  layout?: 'stack' | 'inline';
}

/**
 * Brand mark for auth heroes, page headers, and compact chrome.
 * Asset: /public/logo.png (transparent).
 */
export function AppLogo({
  size = 'md',
  className,
  wordmark = false,
  wordmarkClassName,
  layout = 'stack',
}: AppLogoProps) {
  const mark = (
    <img
      src="/logo.png"
      alt={wordmark ? '' : 'Gym Workout Engine'}
      width={80}
      height={80}
      decoding="async"
      className={cn(SIZE_CLASS[size], 'object-contain flex-shrink-0 select-none', !wordmark && className)}
      draggable={false}
    />
  );

  if (!wordmark) return mark;

  return (
    <div
      className={cn(
        layout === 'inline' ? 'flex items-center gap-2.5' : 'flex flex-col items-center',
        className,
      )}
    >
      {mark}
      <span
        className={cn(
          'font-bold text-white tracking-tight',
          layout === 'stack' ? 'text-2xl mt-3' : 'text-base',
          wordmarkClassName,
        )}
      >
        Gym Workout Engine
      </span>
    </div>
  );
}
