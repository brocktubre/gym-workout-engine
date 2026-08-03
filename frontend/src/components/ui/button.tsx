import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF375F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-[#FF375F] text-white shadow-lg shadow-[#FF375F]/30 hover:bg-[#E02D50]',
        secondary:
          'bg-[#2c2c2e] text-white border border-[#38383A] hover:bg-[#3a3a3c]',
        outline:
          'border border-[#38383A] bg-transparent text-white hover:bg-[#2c2c2e]',
        ghost:
          'bg-transparent text-white hover:bg-[#2c2c2e]',
        destructive:
          'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30',
        success:
          'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30 hover:bg-[#30D158]/30',
        blue:
          'bg-[#0A84FF] text-white shadow-lg shadow-[#0A84FF]/30 hover:bg-[#0070E0]',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 px-3 py-1.5 text-xs',
        lg: 'h-14 px-8 py-3 text-base rounded-2xl',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
