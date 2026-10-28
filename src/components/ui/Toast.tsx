import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Check, AlertCircle } from 'lucide-react';

type Tone = 'success' | 'error';
export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
  action?: ToastAction;
}

type Notify = (text: string, tone?: Tone, action?: ToastAction) => void;

const ToastContext = createContext<Notify>(() => undefined);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const notify = useCallback<Notify>(
    (text, tone = 'success', action) => {
      const id = ++seq.current;
      setToasts(t => [...t.slice(-2), { id, text, tone, action }]);
      // Toasts with an action (Undo) stay long enough to react
      setTimeout(() => dismiss(id), action ? 6000 : tone === 'error' ? 5000 : 2600);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full border py-2.5 pr-4 pl-4 text-sm font-bold shadow-xl ${
              t.tone === 'error' ? 'border-danger/40 bg-[#fbeceb] text-danger' : 'border-gold/50 bg-night text-[#f4f0ee] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]'
            }`}
          >
            {t.tone === 'error' ? (
              <AlertCircle size={16} className="shrink-0 text-danger" />
            ) : (
              <Check size={16} className="shrink-0 text-gold" />
            )}
            <span className="min-w-0 truncate">{t.text}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="-my-1 -mr-2 ml-1 shrink-0 rounded-full px-3 py-1 text-gold hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
