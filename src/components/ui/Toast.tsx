import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Check, AlertCircle } from 'lucide-react';

type Tone = 'success' | 'error';
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => undefined);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const seq = useRef(0);

  const notify = useCallback((text: string, tone: Tone = 'success') => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 5000 : 2600);
  }, []);

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
            className={`animate-rise flex max-w-md items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-bold shadow-xl ${
              t.tone === 'error' ? 'border-danger/40 bg-[#fbeceb] text-danger' : 'border-night bg-night text-[#f4f0ee]'
            }`}
          >
            {t.tone === 'error' ? (
              <AlertCircle size={16} className="shrink-0 text-danger" />
            ) : (
              <Check size={16} className="shrink-0 text-gold" />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
