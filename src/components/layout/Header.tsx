import { CloudOff, Database, RefreshCw } from 'lucide-react';
import type { SyncStatus } from '@/hooks/useInventory';
import { cx, formatTime } from '@/lib/format';

interface Props {
  status: SyncStatus;
  syncing: boolean;
  pending: number;
  lastSynced: Date | null;
  onOpenSettings: () => void;
}

function statusCopy(status: SyncStatus, pending: number, lastSynced: Date | null) {
  if (status === 'offline') return pending ? `Offline · ${pending} to upload` : 'Offline';
  if (status === 'missing_table') return 'Set up database';
  if (status === 'checking') return 'Connecting…';
  if (pending) return `${pending} to upload`;
  return lastSynced ? `Synced ${formatTime(lastSynced)}` : 'Online';
}

/** Dark band like the brasaousa.com header: faint diamond grid + warm glow. */
export function Header({ status, syncing, pending, lastSynced, onOpenSettings }: Props) {
  const tone =
    status === 'connected' && !pending
      ? 'border-gold/40 text-[#f4f0ee]'
      : status === 'missing_table'
        ? 'border-[#e0675f]/60 text-[#f4c1bc]'
        : 'border-white/15 text-[#c9bfb0]';

  return (
    <header className="night sticky top-0 z-40 pt-[env(safe-area-inset-top)] shadow-[0_6px_20px_-12px_rgba(28,27,25,0.6)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/brasao-logo.png" alt="Brasão" className="h-9 w-auto shrink-0 brightness-0 invert md:h-10" />
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <span className="font-display truncate text-lg italic text-gold">Inventory</span>
        </div>

        <button
          onClick={onOpenSettings}
          className={cx(
            'flex items-center gap-2 rounded-full border bg-white/5 py-1.5 pr-3 pl-2.5 text-[13px] font-bold transition hover:border-gold',
            'focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none',
            tone,
          )}
          aria-label={`Sync status: ${statusCopy(status, pending, lastSynced)}. Open settings`}
        >
          {syncing ? (
            <RefreshCw size={14} className="animate-spin text-gold" />
          ) : status === 'offline' ? (
            <CloudOff size={14} />
          ) : status === 'missing_table' ? (
            <Database size={14} />
          ) : (
            <span className={cx('h-2 w-2 rounded-full', pending ? 'bg-gold-soft' : 'bg-gold')} />
          )}
          <span className="max-w-[44vw] truncate">{statusCopy(status, pending, lastSynced)}</span>
        </button>
      </div>
    </header>
  );
}
