import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, Download, Search, Trash2, X } from 'lucide-react';
import { buildReport, downloadReportCsv, reportTotals } from '@/lib/report';
import { shortCategory } from '@/data/catalog';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { EntrySheet } from './EntrySheet';
import type { InventoryEntry, NewEntry, ReportRow } from '@/types';
import { cx, formatMoney, formatQty, normalizeText } from '@/lib/format';

type Filter = 'all' | 'wine' | 'liquor';

interface Props {
  entries: InventoryEntry[];
  canClear: boolean;
  onUpdate: (id: string, changes: Partial<NewEntry>) => void;
  onRemove: (id: string) => void;
  onClearAll: () => Promise<void>;
}

export function ReportScreen({ entries, canClear, onUpdate, onRemove, onClearAll }: Props) {
  const notify = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const rows = useMemo(() => buildReport(entries), [entries]);
  const totals = useMemo(() => reportTotals(rows), [rows]);

  const visible = useMemo(() => {
    const q = normalizeText(query.trim());
    return rows.filter(
      r =>
        (filter === 'all' || (filter === 'liquor') === r.isLiquor) &&
        (!q || normalizeText(r.name).includes(q) || normalizeText(r.category).includes(q)),
    );
  }, [rows, filter, query]);

  // Group by category for scanning the list
  const groups = useMemo(() => {
    const m = new Map<string, ReportRow[]>();
    visible.forEach(r => m.set(r.category, [...(m.get(r.category) ?? []), r]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const selectedRow = rows.find(r => r.name === selected) ?? null;
  const closeSheet = useCallback(() => setSelected(null), []);

  const clear = async () => {
    setClearing(true);
    try {
      await onClearAll();
      notify('Inventory cleared');
      setConfirmClear(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not clear the inventory', 'error');
    } finally {
      setClearing(false);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <h1 className="font-display text-3xl italic">No counts yet</h1>
        <p className="mt-3 max-w-sm text-muted">
          Count products on the Count tab or scan a count sheet. The inventory value shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-[34px] leading-[0.95] font-black tracking-tight uppercase md:text-5xl">Inventory</h1>
        <p className="font-display text-[34px] leading-none italic text-gold-deep md:text-5xl">report.</p>
      </header>

      <section className="overflow-hidden rounded-2xl bg-night p-5 text-[#f4f0ee] md:p-7">
        <p className="text-sm text-[#c9bfb0]">Inventory value at menu price</p>
        <p className="num mt-2 text-5xl leading-none font-semibold text-gold md:text-6xl">{formatMoney(totals.value)}</p>
        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          {[
            ['Bottles in cellar', formatQty(totals.cellar)],
            ['Bottles at bar', formatQty(totals.bar)],
            ['Products', String(totals.products)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[#c9bfb0]">{k}</dt>
              <dd className="num mt-1 text-2xl font-semibold text-[#f4f0ee]">{v}</dd>
            </div>
          ))}
        </dl>
        {totals.uncategorized > 0 && (
          <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-[13px] text-gold-soft">
            {totals.uncategorized} {totals.uncategorized === 1 ? 'product is' : 'products are'} not in the catalog and count
            as $0.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" size={18} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search the report"
              aria-label="Search the report"
              className="field pl-11"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <Button onClick={() => downloadReportCsv(rows)} aria-label="Export CSV" className="px-4">
            <Download size={18} /> <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>

        <div className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['wine', 'Wine'],
              ['liquor', 'Spirits'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cx(
                'rounded-full border px-4 py-1.5 text-[13px] font-bold transition',
                filter === f ? 'border-fg bg-fg text-page' : 'border-line bg-surface text-muted hover:text-fg',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {groups.map(([category, list]) => (
          <div key={category}>
            <h2 className="mb-2 flex items-baseline justify-between px-1">
              <span className="font-display text-xl italic text-fg">{shortCategory(category)}</span>
              <span className="text-sm text-muted">{formatMoney(list.reduce((s, r) => s + r.totalValue, 0))}</span>
            </h2>
            <ul className="card divide-y divide-line/60 overflow-hidden">
              {list.map(r => (
                <li key={r.name}>
                  <button
                    onClick={() => setSelected(r.name)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-field focus-visible:bg-field focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-fg">{r.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {r.cellarQty > 0 && `Cellar ${formatQty(r.cellarQty)}`}
                        {r.cellarQty > 0 && r.barQty > 0 && '  ·  '}
                        {r.barQty > 0 && `Bar ${formatQty(r.barQty)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-lg font-semibold text-fg">{formatQty(r.totalQty)}</p>
                      <p className="text-[13px] text-gold-ink/90">{formatMoney(r.totalValue)}</p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="py-8 text-center text-muted">Nothing matches your search.</p>}
      </section>

      <div className="flex justify-center pt-2">
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          <Trash2 size={16} /> Clear entire inventory
        </Button>
      </div>

      <EntrySheet row={selectedRow} entries={entries} onClose={closeSheet} onUpdate={onUpdate} onRemove={onRemove} />

      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the entire inventory?"
        subtitle="This deletes every record on every device. Export the CSV first if you need it."
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 !bg-danger !text-white"
              disabled={!canClear || clearing}
              onClick={clear}
            >
              {clearing ? 'Clearing…' : `Delete ${entries.length} records`}
            </Button>
          </div>
        }
      >
        {!canClear && <p className="pb-2 text-sm text-gold-ink">You need an internet connection to clear the inventory.</p>}
      </Sheet>
    </div>
  );
}
