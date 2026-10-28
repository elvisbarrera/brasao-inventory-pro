const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const moneyCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatMoney = (n: number, cents = false) => (cents ? moneyCents : money).format(n);

/** 2 -> "2", 2.5 -> "2.5", 0.75 -> "0.75" */
export const formatQty = (n: number) => String(Math.round(n * 100) / 100);

export const formatTime = (ts: number | Date) =>
  new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
