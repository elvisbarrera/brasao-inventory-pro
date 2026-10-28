import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { BottleLevel } from './BottleLevel';
import { LocationType } from '@/types';
import { formatQty } from '@/lib/format';
import { shortCategory } from '@/data/catalog';

export interface CountTarget {
  name: string;
  category: string;
  price?: string;
  alreadyCounted: number;
}

interface Props {
  target: CountTarget | null;
  location: LocationType;
  onClose: () => void;
  onSave: (qty: number) => void;
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label={`Remove one from ${label}`}
        className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-line bg-field text-fg transition active:scale-95 disabled:opacity-30"
        disabled={value <= 0}
      >
        <Minus size={26} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0))}
        onFocus={e => e.target.select()}
        className="num w-full min-w-0 bg-transparent text-center text-7xl leading-none font-black text-fg outline-none"
      />
      <button
        onClick={() => onChange(value + 1)}
        aria-label={`Add one to ${label}`}
        className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gold text-on-gold transition active:scale-95"
      >
        <Plus size={26} />
      </button>
    </div>
  );
}

export function CountSheet({ target, location, onClose, onSave }: Props) {
  const isBar = location === LocationType.BAR;
  const [bottles, setBottles] = useState(1);
  const [openLevel, setOpenLevel] = useState(0);

  // Reset every time a new product is opened
  useEffect(() => {
    if (!target) return;
    setBottles(isBar ? 0 : 1);
    setOpenLevel(isBar ? 1 : 0);
  }, [target, isBar]);

  const total = bottles + (isBar ? openLevel : 0);
  const unit = total === 1 ? 'bottle' : 'bottles';

  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      title={target?.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{target && shortCategory(target.category)}</span>
          {target?.price && <span className="text-gold-ink">{target.price}{isBar ? ' per pour' : ''}</span>}
          {target && target.alreadyCounted > 0 && (
            <span>Already counted here: {formatQty(target.alreadyCounted)}</span>
          )}
        </span>
      }
      footer={
        <Button variant="primary" className="w-full text-base" onClick={() => onSave(total)} disabled={total <= 0}>
          Save {formatQty(total)} {unit} to {isBar ? 'Bar' : 'Cellar'}
        </Button>
      }
    >
      <div className="space-y-6 py-2">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-muted">{isBar ? 'Sealed bottles' : 'Bottles'}</h3>
          <Stepper value={bottles} onChange={setBottles} label={isBar ? 'Sealed bottles' : 'Bottles'} />
          {!isBar && (
            <div className="flex gap-2">
              {[6, 12].map(n => (
                <button
                  key={n}
                  onClick={() => setBottles(b => b + n)}
                  className="flex-1 rounded-xl border border-line bg-field py-2.5 text-sm font-bold text-muted transition hover:text-fg"
                >
                  + case of {n}
                </button>
              ))}
            </div>
          )}
        </section>

        {isBar && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-muted">Open bottle</h3>
            <BottleLevel value={openLevel} onChange={setOpenLevel} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
