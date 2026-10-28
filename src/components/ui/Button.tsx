import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const styles: Record<Variant, string> = {
  primary: 'bg-gold text-on-gold hover:bg-gold-soft active:bg-gold-deep font-bold',
  secondary: 'border border-line bg-field text-fg hover:border-gold/50',
  ghost: 'text-muted hover:bg-field hover:text-fg',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] transition',
        'focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        styles[variant],
        className,
      )}
    />
  );
}
