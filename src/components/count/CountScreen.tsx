import { useMemo, useState, useDeferredValue } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { MASTER_WINE_LIST, isLiquorCategory, shortCategory } from '@/data/catalog';
import { LocationToggle } from '@/components/ui/LocationToggle';
import { CountSheet, type CountTarget } from './CountSheet';
import { useToast } from '@/components/ui/Toast';
import { LocationType, type InventoryEntry, type NewEntry } from '@/types';
import { cx, formatQty, normalizeText } from '@/lib/format';

interface Props {
  entries: InventoryEntry[];
  location: LocationType;
  onLocation: (l: LocationType) => void;
  onAdd: (items: NewEntry[]) => void;
}

export function CountScreen({ entries, location, onLocation, onAdd }: Props) {
  const notify = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [target, setTarget] = useState<CountTarget | null>(null);
  const deferredQuery = useDeferredValue(query);

  const isBar = location === LocationType.BAR;

  const list = useMemo(
    () => MASTER_WINE_LIST.filter(i => isLiquorCategory(i.category) === isBar),
    [isBar],
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    list.forEach(i => counts.set(i.category, (counts.get(i.category) ?? 0) + 1));
    return ['All', ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)];
  }, [list]);

  // Running total per product at this location
  const counted = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach(e => e.location === location && m.set(e.itemName, (m.get(e.itemName) ?? 0) + e.qty));
    return m;
  }, [entries, location]);

  const results = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    return list.filter(
      i =>
        (category === 'All' || i.category === category) &&
        (!q || normalizeText(i.name).includes(q) || normalizeText(i.category).includes(q)),
    );
  }, [list, category, deferredQuery]);

  const changeLocation = (l: LocationType) => {
    onLocation(l);
    setCategory('All');
    setQuery('');
  };

  const open = (name: string, cat: string, price?: string) =>
    setTarget({ name, category: cat, price, alreadyCounted: counted.get(name) ?? 0 });

  const save = (qty: number) => {
    if (!target) return;
    onAdd([{ itemName: target.name, location, qty }]);
    notify(`${formatQty(qty)} × ${target.name}`);
    setTarget(null);
  };

  const countedProducts = [...counted.values()].filter(v => v > 0).length;

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] leading-none italic md:text-4xl">
              {isBar ? 'Bar count' : 'Cellar count'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {countedProducts > 0
                ? `${countedProducts} of ${list.length} products counted`
                : `Tap a product to count it. ${list.length} in the catalog.`}
            </p>
          </div>
        </div>

        <LocationToggle value={location} onChange={changeLocation} />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" size={18} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isBar ? 'Search spirit, brand or type' : 'Search wine, producer or bin number'}
            className="field pl-11"
            aria-label="Search the catalog"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-muted hover:text-cream"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cx(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition',
                category === c ? 'border-gold bg-gold text-ink' : 'border-line text-muted hover:text-cream',
              )}
            >
              {c === 'All' ? 'All' : shortCategory(c)}
            </button>
          ))}
        </div>
      </section>

      <ul className="card divide-y divide-line/60 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
        {results.map(item => {
          const n = counted.get(item.name) ?? 0;
          return (
            <li key={item.id} className="md:border-b md:border-line/60 md:odd:border-r">
              <button
                onClick={() => open(item.name, item.category, item.price)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-ink-3 focus-visible:bg-ink-3 focus-visible:outline-none active:bg-ink-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-cream">{item.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    {shortCategory(item.category)}
                    {item.price && <span className="text-gold/80"> · {item.price}</span>}
                  </p>
                </div>
                {n > 0 ? (
                  <span className="font-display min-w-10 rounded-full bg-gold/15 px-3 py-1 text-center text-lg italic text-gold tabular-nums">
                    {formatQty(n)}
                  </span>
                ) : (
                  <Plus size={18} className="shrink-0 text-muted" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {results.length === 0 && (
        <div className="card space-y-3 px-5 py-8 text-center">
          <p className="text-muted">No products match “{query}”.</p>
          {query.trim().length > 1 && (
            <button
              onClick={() => open(query.trim(), 'Not in catalog')}
              className="inline-flex items-center gap-2 rounded-full border border-gold/50 px-4 py-2 text-sm font-bold text-gold hover:bg-gold/10"
            >
              <Plus size={16} /> Count “{query.trim()}” anyway
            </button>
          )}
        </div>
      )}

      <CountSheet target={target} location={location} onClose={() => setTarget(null)} onSave={save} />
    </div>
  );
}
