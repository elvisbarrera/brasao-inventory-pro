import { useCallback, useState } from 'react';
import { AlertCircle, Database, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav, type Tab } from '@/components/layout/BottomNav';
import { CountScreen } from '@/components/count/CountScreen';
import { ReportScreen } from '@/components/report/ReportScreen';
import { ScanReview } from '@/components/scan/ScanReview';
import { useScanner } from '@/components/scan/useScanner';
import { SettingsSheet } from '@/components/settings/SettingsSheet';
import { useToast } from '@/components/ui/Toast';
import { useInventory } from '@/hooks/useInventory';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { LocationType, type NewEntry } from '@/types';

export default function App() {
  const inventory = useInventory();
  const deleteEntries = useDeleteWithUndo(inventory);
  const notify = useToast();
  const [tab, setTab] = useState<Tab>('count');
  const [location, setLocation] = useState<LocationType>(LocationType.CELLAR);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const onScanError = useCallback((msg: string) => notify(msg, 'error'), [notify]);
  const scanner = useScanner(location, onScanError);

  const saveScan = (items: NewEntry[]) => {
    inventory.add(items);
    scanner.close();
    notify(`${items.length} ${items.length === 1 ? 'product' : 'products'} added from the scan`);
  };

  return (
    <div className="min-h-dvh">
      <Header
        status={inventory.status}
        syncing={inventory.syncing}
        pending={inventory.pending}
        lastSynced={inventory.lastSynced}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="relative">
      <div aria-hidden className="lattice-band pointer-events-none absolute inset-x-0 top-0" />
      <main className="relative mx-auto max-w-5xl px-4 pt-8 pb-36 md:px-8 md:pt-12">
        {inventory.status === 'missing_table' && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-left"
          >
            <Database size={20} className="shrink-0 text-danger" />
            <span className="text-sm">
              <strong className="block text-fg">The database needs a one-time setup</strong>
              <span className="text-muted">Counts are being saved on this device. Tap to see the setup steps.</span>
            </span>
          </button>
        )}

        {inventory.error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-gold-ink" />
            <p className="flex-1 text-muted">{inventory.error}</p>
            <button onClick={inventory.dismissError} aria-label="Dismiss" className="text-muted hover:text-fg">
              <X size={16} />
            </button>
          </div>
        )}

        {tab === 'count' ? (
          <CountScreen entries={inventory.entries} location={location} onLocation={setLocation} onAdd={inventory.add} onDelete={deleteEntries} />
        ) : (
          <ReportScreen
            entries={inventory.entries}
            canClear={inventory.status === 'connected'}
            onUpdate={inventory.update}
            onDelete={deleteEntries}
            onClearAll={inventory.clearAll}
          />
        )}
      </main>
      </div>

      <BottomNav tab={tab} onTab={setTab} onScan={scanner.start} scanning={scanner.busy} />
      {scanner.input}

      <ScanReview items={scanner.items} preview={scanner.preview} onClose={scanner.close} onConfirm={saveScan} />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={inventory.status}
        syncing={inventory.syncing}
        pending={inventory.pending}
        lastSynced={inventory.lastSynced}
        totalEntries={inventory.entries.length}
        onSync={inventory.sync}
      />
    </div>
  );
}
