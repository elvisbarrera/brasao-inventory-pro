import { cx } from '@/lib/format';

const LEVELS = [
  { value: 0, label: 'Empty' },
  { value: 0.25, label: '¼' },
  { value: 0.5, label: '½' },
  { value: 0.75, label: '¾' },
  { value: 1, label: 'Full' },
];

/** Tap-to-set fill level for an open bottle, drawn as a bottle silhouette. */
export function BottleLevel({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const fillTop = 140 - 104 * value; // liquid height inside the body (y 36..140)

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 80 150" className="h-40 w-auto shrink-0" aria-hidden>
        <defs>
          <clipPath id="bottle-body">
            <path d="M32 4h16v22c0 6 16 10 16 26v84c0 6-4 10-10 10H26c-6 0-10-4-10-10V52c0-16 16-20 16-26z" />
          </clipPath>
          <linearGradient id="liquid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d6c095" />
            <stop offset="1" stopColor="#a98c55" />
          </linearGradient>
        </defs>
        <g clipPath="url(#bottle-body)">
          <rect x="0" y="0" width="80" height="150" fill="#f1ebe1" />
          <rect
            x="0"
            y={fillTop}
            width="80"
            height={150 - fillTop}
            fill="url(#liquid)"
            style={{ transition: 'y 0.35s ease, height 0.35s ease' }}
          />
          {[0.25, 0.5, 0.75].map(l => (
            <line key={l} x1="16" x2="22" y1={140 - 104 * l} y2={140 - 104 * l} stroke="#1c1b19" strokeOpacity=".35" />
          ))}
        </g>
        <path
          d="M32 4h16v22c0 6 16 10 16 26v84c0 6-4 10-10 10H26c-6 0-10-4-10-10V52c0-16 16-20 16-26z"
          fill="none"
          stroke="#a98c55"
          strokeOpacity=".9"
          strokeWidth="1.5"
        />
      </svg>

      <div role="radiogroup" aria-label="Open bottle level" className="flex flex-1 flex-col-reverse gap-1.5">
        {LEVELS.map(l => {
          const active = value === l.value;
          return (
            <button
              key={l.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(l.value)}
              className={cx(
                'flex items-center justify-between rounded-xl border px-4 py-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none',
                active ? 'border-gold bg-gold/15 text-fg' : 'border-line bg-field text-muted hover:text-fg',
              )}
            >
              <span className="font-display text-xl italic">{l.label}</span>
              <span className="text-xs tabular-nums">{l.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
