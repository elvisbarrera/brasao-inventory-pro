import { Camera, ClipboardList, Loader2, Receipt } from 'lucide-react';
import { cx } from '@/lib/format';

export type Tab = 'count' | 'report';

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  onScan: () => void;
  scanning: boolean;
}

export function BottomNav({ tab, onTab, onScan, scanning }: Props) {
  const item = (t: Tab, label: string, Icon: typeof ClipboardList) => (
    <button
      onClick={() => onTab(t)}
      aria-current={tab === t ? 'page' : undefined}
      className={cx(
        'flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[12px] font-bold transition focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none',
        tab === t ? 'text-gold' : 'text-muted hover:text-cream',
      )}
    >
      <Icon size={22} strokeWidth={tab === t ? 2.2 : 1.8} />
      {label}
    </button>
  );

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-ink/95 backdrop-blur-md md:bottom-5 md:left-1/2 md:w-[380px] md:-translate-x-1/2 md:rounded-3xl md:border md:pb-3 md:shadow-2xl">
      <div className="mx-auto flex max-w-md items-end justify-around gap-2 px-6 pt-2">
        {item('count', 'Count', ClipboardList)}
        <button
          onClick={onScan}
          disabled={scanning}
          aria-label="Scan a photo"
          className="-mt-7 flex flex-col items-center gap-1 text-[12px] font-bold text-cream focus-visible:outline-none disabled:opacity-80"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-ink bg-gold text-ink shadow-[0_8px_24px_-6px_rgba(201,169,110,0.55)] transition active:scale-95">
            {scanning ? <Loader2 size={26} className="animate-spin" /> : <Camera size={26} strokeWidth={2} />}
          </span>
          {scanning ? 'Reading…' : 'Scan'}
        </button>
        {item('report', 'Report', Receipt)}
      </div>
    </nav>
  );
}
