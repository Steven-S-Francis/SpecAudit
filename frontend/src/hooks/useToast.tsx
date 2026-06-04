import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  timestamp: number;
};

export type AddToast = (message: string, type?: ToastType, duration?: number) => void;

type ToastContextValue = {
  toasts: Toast[];
  addToast: AddToast;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

export function useToast(): ToastContextValue {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const debounceRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const now = Date.now();
      const lastTime = debounceRef.current.get(message);
      if (lastTime !== undefined && now - lastTime < 2000) {
        return;
      }
      debounceRef.current.set(message, now);

      const id = generateId();
      const toast: Toast = { id, message, type, duration, timestamp: now };

      setToasts(prev => {
        const next = [...prev, toast];
        if (next.length > 3) {
          const sorted = [...next].sort((a, b) => a.timestamp - b.timestamp);
          const oldest = sorted[0];
          const timeout = timeoutsRef.current.get(oldest.id);
          if (timeout) {
            clearTimeout(timeout);
            timeoutsRef.current.delete(oldest.id);
          }
          return next.filter(t => t.id !== oldest.id);
        }
        return next;
      });

      if (duration > 0) {
        const timeoutId = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timeoutsRef.current.set(id, timeoutId);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return { toasts, addToast, dismissToast };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const toastState = useToast();
  return (
    <ToastContext.Provider value={toastState}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be used within a <ToastProvider>');
  }
  return ctx;
}
