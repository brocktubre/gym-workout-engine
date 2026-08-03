import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[#FF375F]/20 text-[#FF375F] border border-[#FF375F]/20',
        secondary:
          'bg-[#2c2c2e] text-[#8E8E93] border border-[#38383A]',
        outline:
          'bg-transparent text-white border border-[#38383A]',
        success:
          'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/20',
        blue:
          'bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/20',
        orange:
          'bg-[#FF9F0A]/20 text-[#FF9F0A] border border-[#FF9F0A]/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
