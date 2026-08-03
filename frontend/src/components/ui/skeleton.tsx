import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[#2c2c2e]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
