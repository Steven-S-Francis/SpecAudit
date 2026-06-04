import { useToastContext } from '../../hooks/useToast';
import type { ToastType } from '../../hooks/useToast';

const borderColorMap: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

const closeButtonClass =
  'absolute top-2 right-2 text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-700';

export function ToastContainer() {
  const { toasts, dismissToast } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .animate-toast-in {
          animation: toast-slide-in 200ms ease-out;
        }
      `}</style>
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        role="alert"
        aria-live="polite"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`animate-toast-in relative ${borderColorMap[toast.type]} bg-slate-800 text-slate-200 border border-slate-700 light:bg-white light:text-slate-800 light:border-slate-300 rounded-lg shadow-xl p-3 pr-10 pointer-events-auto`}
          >
            {toast.message}
            <button
              onClick={() => dismissToast(toast.id)}
              className={closeButtonClass}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
