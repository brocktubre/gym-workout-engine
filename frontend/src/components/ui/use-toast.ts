import * as React from 'react';

export type ToastVariant = 'default' | 'success' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string }
  | { type: 'UPDATE'; id: string; toast: Partial<Toast> };

interface ToastState {
  toasts: Toast[];
}

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [...state.toasts, action.toast] };
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'UPDATE':
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t,
        ),
      };
    default:
      return state;
  }
}

// Global dispatch store
let dispatch: React.Dispatch<ToastAction> | null = null;

export function setToastDispatch(d: React.Dispatch<ToastAction>) {
  dispatch = d;
}

let idCounter = 0;

export function toast(options: Omit<Toast, 'id'>) {
  const id = String(++idCounter);
  const duration = options.duration ?? 4000;

  if (dispatch) {
    dispatch({ type: 'ADD', toast: { ...options, id } });
    if (duration > 0) {
      setTimeout(() => {
        dispatch?.({ type: 'REMOVE', id });
      }, duration);
    }
  }

  return id;
}

export function useToastState() {
  const [state, localDispatch] = React.useReducer(toastReducer, { toasts: [] });

  React.useEffect(() => {
    setToastDispatch(localDispatch);
    return () => {
      if (dispatch === localDispatch) dispatch = null;
    };
  }, [localDispatch]);

  const dismiss = React.useCallback((id: string) => {
    localDispatch({ type: 'REMOVE', id });
  }, []);

  return { toasts: state.toasts, dismiss };
}
