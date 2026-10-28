import type { InventoryEntry } from '@/types';

/**
 * Device storage. Every change lands here first; ids in the pending queues
 * are uploaded to Supabase by the sync engine (see hooks/useInventory).
 */
const ENTRIES_KEY = 'wine_inventory_data';
const PENDING_UPSERTS_KEY = 'brasao_pending_upserts';
const PENDING_DELETES_KEY = 'brasao_pending_deletes';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: nothing else we can do */
  }
}

const readIds = (key: string) => {
  const v = read<unknown>(key, []);
  return Array.isArray(v) ? v.map(String) : [];
};
const writeIds = (key: string, ids: string[]) => write(key, Array.from(new Set(ids)));

export const localStore = {
  getEntries(): InventoryEntry[] {
    const v = read<unknown>(ENTRIES_KEY, []);
    return Array.isArray(v) ? (v as InventoryEntry[]) : [];
  },
  saveEntries(entries: InventoryEntry[]) {
    write(ENTRIES_KEY, entries);
  },

  pendingUpserts: () => readIds(PENDING_UPSERTS_KEY),
  pendingDeletes: () => readIds(PENDING_DELETES_KEY),
  pendingCount: () => readIds(PENDING_UPSERTS_KEY).length + readIds(PENDING_DELETES_KEY).length,

  markUpsert(ids: string[]) {
    writeIds(PENDING_UPSERTS_KEY, [...readIds(PENDING_UPSERTS_KEY), ...ids]);
    const set = new Set(ids);
    writeIds(PENDING_DELETES_KEY, readIds(PENDING_DELETES_KEY).filter(id => !set.has(id)));
  },
  markDelete(id: string) {
    writeIds(PENDING_UPSERTS_KEY, readIds(PENDING_UPSERTS_KEY).filter(x => x !== id));
    writeIds(PENDING_DELETES_KEY, [...readIds(PENDING_DELETES_KEY), id]);
  },
  clearUpserts(ids: string[]) {
    const done = new Set(ids);
    writeIds(PENDING_UPSERTS_KEY, readIds(PENDING_UPSERTS_KEY).filter(id => !done.has(id)));
  },
  clearDeletes(ids: string[]) {
    const done = new Set(ids);
    writeIds(PENDING_DELETES_KEY, readIds(PENDING_DELETES_KEY).filter(id => !done.has(id)));
  },
  clearAll() {
    [ENTRIES_KEY, PENDING_UPSERTS_KEY, PENDING_DELETES_KEY].forEach(k => localStorage.removeItem(k));
  },
};
