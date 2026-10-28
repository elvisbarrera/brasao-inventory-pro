import { bottleValue, canonicalName, findCatalogItem, isLiquorCategory, priceNumber } from '@/data/catalog';
import { LocationType, type InventoryEntry, type ReportRow } from '@/types';

export function buildReport(entries: InventoryEntry[]): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  for (const e of entries) {
    const item = findCatalogItem(e.itemName);
    const name = canonicalName(e.itemName);
    const row =
      rows.get(name) ??
      ({
        name,
        category: item?.category ?? 'Uncategorized',
        isLiquor: item ? isLiquorCategory(item.category) : false,
        unitPrice: priceNumber(item),
        cellarQty: 0,
        barQty: 0,
        totalQty: 0,
        totalValue: 0,
        lastCounted: 0,
      } satisfies ReportRow);
    if (e.location === LocationType.CELLAR) row.cellarQty += e.qty;
    else row.barQty += e.qty;
    row.totalQty = round(row.cellarQty + row.barQty);
    row.totalValue = bottleValue(item) * row.totalQty;
    row.lastCounted = Math.max(row.lastCounted, e.timestamp);
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface ReportTotals {
  value: number;
  cellar: number;
  bar: number;
  products: number;
  uncategorized: number;
}

export const reportTotals = (rows: ReportRow[]): ReportTotals => ({
  value: rows.reduce((s, r) => s + r.totalValue, 0),
  cellar: round(rows.reduce((s, r) => s + r.cellarQty, 0)),
  bar: round(rows.reduce((s, r) => s + r.barQty, 0)),
  products: rows.length,
  uncategorized: rows.filter(r => r.category === 'Uncategorized').length,
});

const round = (n: number) => Math.round(n * 100) / 100;

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadReportCsv(rows: ReportRow[]) {
  const header = ['Product', 'Category', 'Unit price', 'Unit', 'Cellar', 'Bar', 'Total', 'Total value'];
  const lines = rows.map(r => [
    r.name,
    r.category,
    r.unitPrice.toFixed(2),
    r.isLiquor ? 'pour' : 'bottle',
    r.cellarQty,
    r.barQty,
    r.totalQty,
    r.totalValue.toFixed(2),
  ]);
  const csv = '﻿' + [header, ...lines].map(l => l.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `brasao_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
