import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { LocationToggle } from '@/components/ui/LocationToggle';
import { MASTER_WINE_LIST } from '@/data/catalog';
import { matchCatalog, locationFor, type ScanItem } from '@/services/scan';
import { LocationType, type NewEntry } from '@/types';
import { cx, formatQty } from '@/lib/format';

interface Props {
  items: ScanItem[] | null;
  preview: string | null;
  onClose: () => void;
  onConfirm: (entries: NewEntry[]) => void;
}

export function ScanReview({ items: initial, preview, onClose, onConfirm }: Props) {
  const [items, setItems] = useState<ScanItem[]>([]);
  useEffect(() => setItems(initial ?? []), [initial]);

  const update = (key: string, patch: Partial<ScanItem>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));

  const rename = (it: ScanItem, value: string) => {
    const match = matchCatalog(value);
    const exact = Boolean(match && match.name === value);
    update(it.key, {
      itemName: value,
      matched: exact,
      location: exact ? locationFor(match, it.location) : it.location,
      selected: exact ? true : it.selected,
    });
  };

  const chosen = items.filter(i => i.selected && i.itemName.trim() && i.qty > 0);
  const unmatched = items.filter(i => !i.matched).length;
  const bottles = items.some(i => i.kind === 'bottle');

  return (
    <Sheet
      open={initial !== null}
      onClose={onClose}
      size="lg"
      title="Review the scan"
      subtitle={
        items.length === 0
          ? 'No products recognized.'
          : `${items.length} ${items.length === 1 ? 'product' : 'products'} found${
              bottles ? ' in the bottle photo' : ''
            }${unmatched ? `. ${unmatched} not matched to the catalog.` : '.'}`
      }
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>
            Discard
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={chosen.length === 0}
            onClick={() => onConfirm(chosen.map(i => ({ itemName: i.itemName.trim(), qty: i.qty, location: i.location })))}
          >
            <Check size={18} /> Save {chosen.length} to inventory
          </Button>
        </div>
      }
    >
      <datalist id="catalog-names">
        {MASTER_WINE_LIST.map(i => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      {preview && (
        <img src={preview} alt="Scanned photo" className="mb-4 h-40 w-full rounded-2xl border border-line bg-page object-contain" />
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-muted">
          Take the photo closer, in good light, with labels or the sheet facing the camera.
        </p>
      ) : (
        <ul className="space-y-3 pb-2">
          {items.map(it => (
            <li
              key={it.key}
              className={cx('rounded-2xl border p-3.5 transition', it.selected ? 'border-line bg-field/60' : 'border-line/50 opacity-55')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={it.selected}
                  onChange={e => update(it.key, { selected: e.target.checked })}
                  aria-label={`Include ${it.itemName}`}
                  className="mt-3 h-5 w-5 shrink-0 accent-[#c9a96e]"
                />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <input
                    list="catalog-names"
                    value={it.itemName}
                    onChange={e => rename(it, e.target.value)}
                    aria-label="Product"
                    className={cx('field py-2.5 font-bold', !it.matched && 'border-gold/70')}
                  />
                  {(!it.matched || (it.rawName && it.rawName !== it.itemName) || (it.confidence > 0 && it.confidence < 0.6)) && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                      {!it.matched && (
                        <span className="flex items-center gap-1 font-bold text-gold-ink">
                          <AlertTriangle size={13} /> Pick the catalog product
                        </span>
                      )}
                      {it.rawName && it.rawName !== it.itemName && <span>Read as “{it.rawName}”</span>}
                      {it.confidence > 0 && it.confidence < 0.6 && <span className="text-danger">Low confidence</span>}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <LocationToggle compact value={it.location} onChange={l => update(it.key, { location: l })} />
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={it.location === LocationType.BAR ? 0.25 : 1}
                      value={formatQty(it.qty)}
                      onChange={e => update(it.key, { qty: Math.max(0, parseFloat(e.target.value) || 0) })}
                      aria-label="Quantity"
                      className="field num w-24 py-2 text-center text-xl font-bold"
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
