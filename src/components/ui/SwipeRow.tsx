import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { cx } from '@/lib/format';

const ACTION_W = 92; // width of the revealed Delete button
const LOCK_PX = 8; // movement needed to decide horizontal vs vertical
const OPEN_AT = 40; // release past this and the row stays open
const FULL_AT = 0.5; // release past this share of the row width and it deletes

interface Props {
  children: ReactNode;
  onDelete: () => void;
  /** Used in the accessible name of the revealed button, e.g. "Bacardi Gold". */
  label: string;
  className?: string;
}

/**
 * Swipe left to reveal Delete; keep swiping (or tap it) to delete.
 * Vertical scrolling is untouched (touch-action: pan-y); works with mouse drag too.
 * The row's own content keeps working: a tap opens it, a swipe never counts as a tap.
 */
export function SwipeRow({ children, onDelete, label, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0, base: 0 });
  const mode = useRef<'idle' | 'pending' | 'drag'>('idle');
  const swiped = useRef(false); // true after a drag, so the click that follows is ignored
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Close when something else is tapped
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setDx(0);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const width = () => box.current?.offsetWidth ?? 320;

  const commitDelete = () => {
    setLeaving(true);
    setDragging(false);
    setDx(-width());
    window.setTimeout(onDelete, 190);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, base: open ? -ACTION_W : 0 };
    mode.current = 'pending';
    swiped.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode.current === 'idle' || leaving) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;

    if (mode.current === 'pending') {
      if (Math.abs(mx) < LOCK_PX && Math.abs(my) < LOCK_PX) return;
      if (Math.abs(my) > Math.abs(mx)) {
        mode.current = 'idle'; // vertical: let the page scroll
        return;
      }
      mode.current = 'drag';
      swiped.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    setDx(Math.max(-width(), Math.min(0, start.current.base + mx)));
  };

  const finish = () => {
    if (mode.current !== 'drag') {
      mode.current = 'idle';
      return;
    }
    mode.current = 'idle';
    setDragging(false);
    if (-dx >= width() * FULL_AT) return commitDelete();
    if (-dx >= OPEN_AT) {
      setOpen(true);
      setDx(-ACTION_W);
    } else {
      setOpen(false);
      setDx(0);
    }
  };

  // A swipe must not also trigger the row's tap action; a tap on an open row just closes it.
  const onClickCapture = (e: React.MouseEvent) => {
    if (swiped.current) {
      swiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    } else if (open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setDx(0);
    }
  };

  return (
    <div ref={box} className={cx('relative overflow-hidden', className)}>
      {/* Revealed action */}
      <div className="absolute inset-0 flex items-stretch justify-end bg-danger" aria-hidden={!open}>
        <button
          tabIndex={open ? 0 : -1}
          onClick={commitDelete}
          aria-label={`Delete ${label}`}
          className="flex w-[92px] flex-col items-center justify-center gap-1 text-[13px] font-bold text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
        >
          <Trash2 size={20} />
          Delete
        </button>
      </div>

      {/* Row content */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        className={cx(
          'relative bg-surface',
          !dragging && 'transition-transform duration-200 ease-out motion-reduce:transition-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}
