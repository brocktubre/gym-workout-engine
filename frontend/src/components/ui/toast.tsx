import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast } from './use-toast';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const icon = {
    success: <CheckCircle2 className="h-4 w-4 text-[#30D158] shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-[#FF375F] shrink-0" />,
    default: <Info className="h-4 w-4 text-[#0A84FF] shrink-0" />,
  }[toast.variant ?? 'default'];

  const borderColor = {
    success: 'border-[#30D158]/30',
    error: 'border-[#FF375F]/30',
    default: 'border-[#38383A]',
  }[toast.variant ?? 'default'];

  return (
    <ToastPrimitive.Root
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-[#1c1c1e] px-4 py-3 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-right-full',
        borderColor,
      )}
      onOpenChange={(open) => {
        if (!open) onDismiss(toast.id);
      }}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-sm font-semibold text-white leading-tight">
          {toast.title}
        </ToastPrimitive.Title>
        {toast.description && (
          <ToastPrimitive.Description className="text-xs text-[#8E8E93] mt-0.5">
            {toast.description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close
        className="shrink-0 text-[#8E8E93] hover:text-white transition-colors"
        onClick={() => onDismiss(toast.id)}
      >
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export { ToastItem };
