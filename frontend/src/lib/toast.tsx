import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '../ui';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { id, message, tone }].slice(-4));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
      success: (message: string) => pushToast(message, 'success'),
      error: (message: string) => pushToast(message, 'error'),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-4 sm:left-auto sm:items-end sm:p-4"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur sm:w-80',
              item.tone === 'success' &&
                'border-emerald-200 bg-emerald-50/95 text-emerald-900',
              item.tone === 'error' && 'border-red-200 bg-red-50/95 text-red-900',
              item.tone === 'info' && 'border-sky-200 bg-sky-50/95 text-sky-900',
            )}
          >
            {item.tone === 'success' && (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            )}
            <p className="flex-1 text-sm font-medium leading-snug">{item.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
              className="rounded-md p-0.5 text-current/60 hover:bg-black/5 hover:text-current"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      pushToast: () => undefined,
      success: () => undefined,
      error: () => undefined,
    } satisfies ToastContextValue;
  }
  return ctx;
}

/** Optional hook: auto-dismiss is already handled in provider. */
export function useToastEffect(message: string | null, tone: ToastTone = 'success') {
  const toast = useToast();
  useEffect(() => {
    if (message) toast.pushToast(message, tone);
  }, [message, tone, toast]);
}
