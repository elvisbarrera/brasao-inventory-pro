import { MASTER_WINE_LIST } from '../constants.tsx';
import { LocationType, WineItem } from '../types.ts';

export interface ScanItem {
  key: string;
  rawName: string;          // what the AI read in the photo
  itemName: string;         // catalog name (or raw text if no match)
  matched: boolean;
  qty: number;
  location: LocationType;
  kind: 'sheet' | 'bottle';
  confidence: number;
  selected: boolean;
}

const MAX_SIDE = 1600;

/** Resize + re-encode to JPEG so phone photos (often 4-8 MB / HEIC) fit the function limit. */
export async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen. Intenta tomar la foto otra vez.'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Catalog matching ----------

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokens = (s: string) => new Set(normalize(s).split(' ').filter(t => t.length > 1));

const byExactName = new Map(MASTER_WINE_LIST.map(i => [normalize(i.name), i]));

export function matchCatalog(name: string): WineItem | null {
  if (!name) return null;
  const n = normalize(name);
  const exact = byExactName.get(n);
  if (exact) return exact;

  // Bin number ("1207 ...") is the most reliable key on wine sheets
  const bin = n.match(/^(\d{3,5})\b/)?.[1];
  if (bin) {
    const hit = MASTER_WINE_LIST.filter(i => normalize(i.name).startsWith(bin + ' '));
    if (hit.length === 1) return hit[0];
  }

  // Token overlap
  const a = tokens(name);
  if (a.size === 0) return null;
  let best: WineItem | null = null;
  let bestScore = 0;
  for (const item of MASTER_WINE_LIST) {
    const b = tokens(item.name);
    let inter = 0;
    a.forEach(t => { if (b.has(t)) inter++; });
    const score = inter / Math.min(a.size, b.size || 1);
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 0.75 ? best : null;
}

export const locationFor = (item: WineItem | null, fallback: LocationType): LocationType =>
  item ? (item.category.startsWith('Liquor') ? LocationType.BAR : LocationType.CELLAR) : fallback;

// ---------- Scan ----------

export async function scanInventoryPhoto(file: File, fallbackLocation: LocationType): Promise<ScanItem[]> {
  const { base64, mimeType } = await compressImage(file);
  const catalog = MASTER_WINE_LIST.map(i => `${i.name} | ${i.category}`);

  let res: Response;
  try {
    res = await fetch('/api/scan-inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType, catalog }),
    });
  } catch {
    throw new Error('Sin conexión. El escaneo necesita internet.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) throw new Error('El servicio de escaneo no está publicado todavía (función de Netlify).');
    throw new Error(data?.error || `Error del escáner (${res.status})`);
  }

  const raw: any[] = Array.isArray(data.items) ? data.items : [];
  return raw
    .map((r, idx) => {
      const rawName = String(r.name || r.catalogName || '').trim();
      const qty = Math.max(0, Math.round(Number(r.qty) * 100) / 100);
      const item = matchCatalog(String(r.catalogName || '')) || matchCatalog(rawName);
      return {
        key: `${Date.now()}-${idx}`,
        rawName,
        itemName: item ? item.name : rawName,
        matched: Boolean(item),
        qty: Number.isFinite(qty) ? qty : 0,
        location: locationFor(item, fallbackLocation),
        kind: r.kind === 'bottle' ? 'bottle' : 'sheet',
        confidence: Number(r.confidence) || 0,
        selected: Boolean(item) && qty > 0,
      } as ScanItem;
    })
    .filter(i => i.rawName || i.itemName);
}
