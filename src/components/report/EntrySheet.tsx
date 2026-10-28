import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { LocationToggle, locationLabel } from '@/components/ui/LocationToggle';
import { useToast } from '@/components/ui/Toast';
import { LocationType, type InventoryEntry, type NewEntry, type ReportRow } from '@/types';
import { cx, formatMoney, formatQty, formatRelative } from '@/lib/format';

interface Props {
  row: ReportRow | null;
  entries: InventoryEntry[];
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<NewEntry>) => void;
  onRemove: (id: string) => void;
}

function EntryRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: InventoryEntry;
  onUpdate: Props['onUpdate'];
  onRemove: Props['onRemove'];
}) {
  const notify = useToast();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(formatQty(entry.qty));
  const [location, setLocation] = useState(entry.location);

  useEffect(() => {
    setQty(formatQty(entry.qty));
    setLocation(entry.location);
  }, [entry]);

  const save = () => {
    const n = parseFloat(qty);
    if (!Number.isFinite(n) || n < 0) return;
    onUpdate(entry.id, { qty: n, location });
    setEditing(false);
    notify('Record updated');
  };

  if (editing) {
    return (
      <li className="space-y-3 rounded-2xl border border-gold/40 bg-field/60 p-3.5">
        <LocationToggle compact value={location} onChange={setLocation} />
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step={location === LocationType.BAR ? 0.25 : 1}
            min={0}
            value={qty}
            onChange={e => setQty(e.target.value)}
            aria-label="Quantity"
            className="field num flex-1 text-center text-2xl font-medium"
            autoFocus
          />
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-field/40 py-2.5 pr-2 pl-4">
      <span className="num w-14 text-2xl font-semibold text-fg">{formatQty(entry.qty)}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold text-fg">{locationLabel(entry.location)}</p>
        <p className="text-muted">{formatRelative(entry.timestamp)}</p>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="rounded-xl px-3 py-2 text-sm font-bold text-gold-ink hover:bg-gold/10"
      >
        Edit
      </button>
      <button
        onClick={() => {
          onRemove(entry.id);
          notify('Record deleted');
        }}
        aria-label="Delete record"
        className="rounded-xl p-2.5 text-muted hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={18} />
      </button>
    </li>
  );
}

export function EntrySheet({ row, entries, onClose, onUpdate, onRemove }: Props) {
  const list = row ? entries.filter(e => e.itemName === row.name).sort((a, b) => b.timestamp - a.timestamp) : [];

  // Close automatically when the last entry is deleted
  useEffect(() => {
    if (row && list.length === 0) onClose();
  }, [row, list.length, onClose]);

  return (
    <Sheet
      open={Boolean(row)}
      onClose={onClose}
      title={row?.name}
      subtitle={row && `${row.category} · ${list.length} ${list.length === 1 ? 'record' : 'records'}`}
    >
      {row && (
        <div className="space-y-5 pb-2">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Cellar', formatQty(row.cellarQty)],
              ['Bar', formatQty(row.barQty)],
              ['Value', formatMoney(row.totalValue)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-line bg-field/40 py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className={cx('num mt-0.5 text-xl font-semibold', k === 'Value' ? 'text-gold-ink' : 'text-fg')}>{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-2">
            {list.map(e => (
              <EntryRow key={e.id} entry={e} onUpdate={onUpdate} onRemove={onRemove} />
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
