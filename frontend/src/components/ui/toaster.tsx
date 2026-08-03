import * as ToastPrimitive from '@radix-ui/react-toast';
import { useToastState } from './use-toast';
import { ToastItem } from './toast';

export function Toaster() {
  const { toasts, dismiss } = useToastState();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-[100px] right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]" />
    </ToastPrimitive.Provider>
  );
}
