import { Wine, Martini } from 'lucide-react';
import { LocationType } from '@/types';
import { cx } from '@/lib/format';

const OPTIONS = [
  { value: LocationType.CELLAR, label: 'Cellar', hint: 'Wine & champagne', Icon: Wine },
  { value: LocationType.BAR, label: 'Bar', hint: 'Spirits', Icon: Martini },
] as const;

export const locationLabel = (l: LocationType) => (l === LocationType.BAR ? 'Bar' : 'Cellar');

export function LocationToggle({
  value,
  onChange,
  compact = false,
}: {
  value: LocationType;
  onChange: (l: LocationType) => void;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Location" className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-field p-1">
      {OPTIONS.map(({ value: v, label, hint, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cx(
              'flex items-center justify-center gap-2 rounded-xl transition focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none',
              compact ? 'py-2' : 'py-2.5',
              active ? 'bg-fg text-page shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            <Icon size={compact ? 15 : 17} strokeWidth={2} className={active ? 'text-gold' : ''} />
            <span className="text-[15px] font-bold">{label}</span>
            {!compact && <span className={cx('hidden text-xs sm:inline', active ? 'text-page/60' : 'text-muted/70')}>{hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
