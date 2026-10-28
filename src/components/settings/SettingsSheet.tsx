import { useState } from 'react';
import { Check, ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import {
  getSupabaseConfig,
  resetSupabaseConfig,
  saveSupabaseConfig,
  SQL_SETUP_SCRIPT,
  testConnection,
  type ConnectionTest,
} from '@/lib/supabase';
import type { SyncStatus } from '@/hooks/useInventory';
import { cx, formatTime } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  status: SyncStatus;
  syncing: boolean;
  pending: number;
  lastSynced: Date | null;
  totalEntries: number;
  onSync: () => void;
}

const STATUS_COPY: Record<SyncStatus, { title: string; body: string }> = {
  connected: { title: 'Connected', body: 'Counts sync live across every device.' },
  checking: { title: 'Connecting', body: 'Checking the database…' },
  offline: {
    title: 'Offline',
    body: 'Counts are saved on this device and upload automatically when the signal comes back.',
  },
  missing_table: {
    title: 'Database needs setup',
    body: 'Supabase is reachable but the inventory table is missing. Run the SQL script below once.',
  },
};

export function SettingsSheet({ open, onClose, status, syncing, pending, lastSynced, totalEntries, onSync }: Props) {
  const notify = useToast();
  const config = getSupabaseConfig();
  const [showSql, setShowSql] = useState(status === 'missing_table');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.anonKey);
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);

  const copySql = async () => {
    await navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    notify('SQL script copied');
  };

  const runTest = async () => {
    setTesting(true);
    setTest(await testConnection(true));
    setTesting(false);
    onSync();
  };

  const copy = STATUS_COPY[status];

  return (
    <Sheet open={open} onClose={onClose} title="Sync & database" subtitle={`Supabase project ${config.projectId}`}>
      <div className="space-y-5 pb-3">
        <section className="rounded-2xl border border-line bg-ink-3/40 p-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cx(
                'h-2.5 w-2.5 rounded-full',
                status === 'connected' ? 'bg-gold' : status === 'missing_table' ? 'bg-danger' : 'bg-muted',
              )}
            />
            <h3 className="font-display text-xl italic">{copy.title}</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted">{copy.body}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Waiting to upload</dt>
              <dd className="font-bold text-cream">{pending}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Records</dt>
              <dd className="font-bold text-cream">{totalEntries}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Last sync</dt>
              <dd className="font-bold text-cream">{lastSynced ? formatTime(lastSynced) : '—'}</dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={onSync} disabled={syncing}>
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button onClick={runTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test read & write'}
            </Button>
          </div>
          {test && (
            <p className={cx('mt-3 text-sm', test.state === 'connected' && test.canWrite ? 'text-gold-soft' : 'text-danger')}>
              {test.state === 'connected'
                ? test.canWrite
                  ? `Read and write OK · ${test.rowCount} rows in the table`
                  : `Read OK, write blocked: ${test.error}`
                : test.state === 'missing_table'
                  ? 'The inventory table does not exist yet.'
                  : `Could not reach Supabase: ${test.error}`}
            </p>
          )}
        </section>

        <section>
          <button
            onClick={() => setShowSql(s => !s)}
            className="flex w-full items-center justify-between py-2 text-left font-bold text-cream"
            aria-expanded={showSql}
          >
            Database setup script
            <ChevronDown size={18} className={cx('text-muted transition', showSql && 'rotate-180')} />
          </button>
          {showSql && (
            <div className="space-y-3 pt-1">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Copy the script.</li>
                <li>Open Supabase → SQL Editor → New query.</li>
                <li>Paste, run, then tap Sync now.</li>
              </ol>
              <Button className="w-full" onClick={copySql}>
                <Copy size={16} /> Copy SQL script
              </Button>
            </div>
          )}
        </section>

        <section className="border-t border-line/70 pt-2">
          <button
            onClick={() => setShowAdvanced(s => !s)}
            className="flex w-full items-center justify-between py-2 text-left font-bold text-cream"
            aria-expanded={showAdvanced}
          >
            Use a different Supabase project
            <ChevronDown size={18} className={cx('text-muted transition', showAdvanced && 'rotate-180')} />
          </button>
          {showAdvanced && (
            <form
              className="space-y-3 pt-1"
              onSubmit={e => {
                e.preventDefault();
                saveSupabaseConfig(url, key);
                notify('Connection saved');
              }}
            >
              <label className="block space-y-1.5">
                <span className="text-sm text-muted">Project URL</span>
                <input className="field" value={url} onChange={e => setUrl(e.target.value)} required type="url" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm text-muted">Publishable (anon) key</span>
                <input className="field font-mono text-sm" value={key} onChange={e => setKey(e.target.value)} required />
              </label>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">
                  <Check size={16} /> Save connection
                </Button>
                {config.isCustom && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const c = resetSupabaseConfig();
                      setUrl(c.url);
                      setKey(c.anonKey);
                      notify('Back to the Brasão database');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </Sheet>
  );
}
