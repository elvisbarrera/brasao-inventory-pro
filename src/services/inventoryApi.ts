import { getSupabase, TABLE } from '@/lib/supabase';
import { LocationType, type InventoryEntry } from '@/types';

/** Rows written by connection checks; never shown, cleaned up on sync. */
export const TEST_ITEM_NAMES = new Set(['Connection Test Item', '__connection_test__']);

export class TableMissingError extends Error {
  constructor() {
    super("The 'inventory' table is missing in Supabase. Run the SQL script from Settings.");
    this.name = 'TableMissingError';
  }
}

type Row = Record<string, unknown>;

export function rowToEntry(row: Row): InventoryEntry {
  const qty = typeof row.qty === 'number' ? row.qty : parseFloat(String(row.qty));
  return {
    id: String(row.id),
    timestamp: Number(row.timestamp) || Date.now(),
    itemName: String(row.itemName ?? row.itemname ?? row.item_name ?? 'Unnamed'),
    location: row.location === LocationType.BAR ? LocationType.BAR : LocationType.CELLAR,
    qty: Number.isFinite(qty) ? qty : 0,
  };
}

const toRow = (e: InventoryEntry) => ({
  id: e.id,
  timestamp: e.timestamp,
  itemName: e.itemName,
  location: e.location,
  qty: e.qty,
});

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === 'PGRST205' || error.code === '42P01' || /not find the table|schema cache/i.test(error.message)) {
    throw new TableMissingError();
  }
  throw new Error(error.message || 'Database error');
};

export const inventoryApi = {
  async fetchAll(): Promise<InventoryEntry[]> {
    const { data, error } = await getSupabase().from(TABLE).select('*').order('timestamp', { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(rowToEntry);
  },

  /** Insert-or-update; idempotent so it is safe to retry. Returns saved ids. */
  async upsert(entries: InventoryEntry[]): Promise<string[]> {
    if (entries.length === 0) return [];
    const { error } = await getSupabase().from(TABLE).upsert(entries.map(toRow), { onConflict: 'id' });
    if (error) fail(error);
    return entries.map(e => e.id);
  },

  async remove(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const { error } = await getSupabase().from(TABLE).delete().in('id', ids);
    if (error) fail(error);
    return ids;
  },

  async clearAll(): Promise<void> {
    const { error } = await getSupabase().from(TABLE).delete().not('id', 'is', null);
    if (error) fail(error);
  },
};
