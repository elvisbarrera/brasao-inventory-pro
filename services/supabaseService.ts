import { supabase, getSupabaseClient } from '../supabaseClient.ts';
import { InventoryEntry, LocationType } from '../types.ts';

function normalizeRow(row: any): InventoryEntry {
  return {
    id: String(row.id),
    timestamp: Number(row.timestamp) || Date.now(),
    itemName: row.itemName ?? row.itemname ?? row.item_name ?? 'Unnamed Item',
    location: (row.location === LocationType.BAR || row.location === 'Bar') ? LocationType.BAR : LocationType.CELLAR,
    qty: typeof row.qty === 'number' ? row.qty : parseFloat(row.qty) || 0,
  };
}

export const supabaseService = {
  async fetchEntries(): Promise<InventoryEntry[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('inventory')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Supabase Connection Failure:', error);
      if (
        error.code === 'PGRST205' || 
        error.code === '42P01' || 
        error.message?.toLowerCase().includes('not find the table') ||
        error.message?.toLowerCase().includes('schema cache')
      ) {
        const err = new Error("Table 'public.inventory' not found in Supabase. Please run the SQL setup script.");
        (err as any).code = 'TABLE_NOT_FOUND';
        throw err;
      }
      if (error.message.includes('bigint')) {
        throw new Error("Schema Mismatch: Your 'id' column is an Integer but the app uses UUID/Text. Please recreate the table using the SQL fix.");
      }
      throw new Error(error.message || 'Database connection lost.');
    }

    return (data || []).map(normalizeRow);
  },

  async addEntry(entry: InventoryEntry): Promise<InventoryEntry> {
    const client = getSupabaseClient();
    
    // Ensure entry has a valid UUID (Postgres inventory.id is type UUID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.id);
    const validId = isUUID ? entry.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : entry.id);

    // First attempt: insert with camelCase "itemName"
    const payload: any = {
      id: validId,
      timestamp: entry.timestamp,
      itemName: entry.itemName,
      location: entry.location,
      qty: entry.qty,
    };

    let { data, error } = await client
      .from('inventory')
      .insert([payload])
      .select();

    // If Postgres table was created with lowercase itemname column
    if (error && (error.message.includes('column "itemName"') || error.message.includes('itemName does not exist'))) {
      const fallbackPayload = {
        id: entry.id,
        timestamp: entry.timestamp,
        itemname: entry.itemName,
        location: entry.location,
        qty: entry.qty,
      };

      const fallbackResult = await client
        .from('inventory')
        .insert([fallbackPayload])
        .select();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error('Supabase Insert Error:', error.message);
      if (
        error.code === 'PGRST205' || 
        error.code === '42P01' || 
        error.message?.toLowerCase().includes('not find the table')
      ) {
        const err = new Error("Table 'public.inventory' not found in Supabase. Run the SQL script.");
        (err as any).code = 'TABLE_NOT_FOUND';
        throw err;
      }
      if (error.message.includes('bigint')) {
        throw new Error("Database Error: Table 'id' must be type TEXT or UUID.");
      }
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return entry;
    }

    return normalizeRow(data[0]);
  },

  async updateEntry(id: string, updates: Partial<InventoryEntry>): Promise<void> {
    const client = getSupabaseClient();
    const updatePayload: any = { ...updates };

    let { error } = await client
      .from('inventory')
      .update(updatePayload)
      .eq('id', id);

    // Fallback if column itemName is lowercase itemname
    if (error && updates.itemName && (error.message.includes('column "itemName"') || error.message.includes('itemName does not exist'))) {
      delete updatePayload.itemName;
      updatePayload.itemname = updates.itemName;
      const fallbackResult = await client
        .from('inventory')
        .update(updatePayload)
        .eq('id', id);
      error = fallbackResult.error;
    }

    if (error) {
      console.error('Supabase Update Error:', error.message);
      throw new Error(error.message);
    }
  },

  async removeEntry(id: string): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase Delete Error:', error.message);
      throw new Error(error.message);
    }
  },

  async clearAll(): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('inventory')
      .delete()
      .not('id', 'is', null);

    if (error) {
      console.error('Supabase Clear Error:', error.message);
      throw new Error(error.message);
    }
  },

  /**
   * Insert-or-update many rows at once (idempotent: safe to retry).
   * Returns the ids that were saved.
   */
  async upsertEntries(entries: InventoryEntry[]): Promise<string[]> {
    if (entries.length === 0) return [];
    const client = getSupabaseClient();
    const rows = entries.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      itemName: e.itemName,
      location: e.location,
      qty: e.qty,
    }));
    let { error } = await client.from('inventory').upsert(rows, { onConflict: 'id' });

    if (error && (error.message.includes('column "itemName"') || error.message.includes('itemName does not exist') || error.message.includes("'itemName'"))) {
      const lower = rows.map(({ itemName, ...rest }) => ({ ...rest, itemname: itemName }));
      ({ error } = await client.from('inventory').upsert(lower, { onConflict: 'id' }));
    }
    if (error) throw new Error(error.message);
    return entries.map(e => e.id);
  },

  async removeEntries(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const client = getSupabaseClient();
    const { error } = await client.from('inventory').delete().in('id', ids);
    if (error) throw new Error(error.message);
    return ids;
  },

  async syncLocalToCloud(localEntries: InventoryEntry[]): Promise<{ added: number; errors: number }> {
    if (localEntries.length === 0) return { added: 0, errors: 0 };
    try {
      const saved = await this.upsertEntries(localEntries);
      return { added: saved.length, errors: 0 };
    } catch (e) {
      console.warn('Bulk sync failed:', e);
      return { added: 0, errors: localEntries.length };
    }
  }
};
