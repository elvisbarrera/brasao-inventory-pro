import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider dialog on tablets */
  size?: 'md' | 'lg';
}

/** Bottom sheet on phones, centered dialog on tablets. */
export function Sheet({ open, onClose, title, subtitle, children, footer, size = 'md' }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <button
        aria-label="Close"
        className="animate-fade absolute inset-0 bg-[#1c1b19]/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none md:rounded-3xl ${
          size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg'
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line md:hidden" />
        <header className="flex items-start justify-between gap-4 px-5 pt-3 pb-3 md:px-6 md:pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight italic text-fg">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 text-muted transition hover:bg-field hover:text-fg focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-6">{children}</div>
        {footer && <footer className="pb-safe border-t border-line/70 px-5 pt-3 md:px-6 md:pb-5">{footer}</footer>}
      </div>
    </div>
  );
}
