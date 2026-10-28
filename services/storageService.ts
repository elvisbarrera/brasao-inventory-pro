
import { InventoryEntry } from '../types.ts';

const STORAGE_KEY = 'wine_inventory_data';
// Ids that were created/edited on this device and are not confirmed in Supabase yet.
const PENDING_UPSERTS_KEY = 'brasao_pending_upserts';
// Ids deleted on this device that still need to be deleted in Supabase.
const PENDING_DELETES_KEY = 'brasao_pending_deletes';

const readIds = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeIds = (key: string, ids: string[]) => {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
};

export const storageService = {
  saveEntries: (entries: InventoryEntry[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },

  getEntries: (): InventoryEntry[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  clearAll: (): void => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PENDING_UPSERTS_KEY);
    localStorage.removeItem(PENDING_DELETES_KEY);
  },

  // ---- Pending sync queue ----
  getPendingUpserts: (): string[] => readIds(PENDING_UPSERTS_KEY),
  getPendingDeletes: (): string[] => readIds(PENDING_DELETES_KEY),

  markUpsert: (id: string): void => {
    writeIds(PENDING_UPSERTS_KEY, [...readIds(PENDING_UPSERTS_KEY), id]);
    // A re-created/edited id is no longer a pending delete
    writeIds(PENDING_DELETES_KEY, readIds(PENDING_DELETES_KEY).filter(x => x !== id));
  },

  markDelete: (id: string): void => {
    writeIds(PENDING_UPSERTS_KEY, readIds(PENDING_UPSERTS_KEY).filter(x => x !== id));
    // Always delete remotely too: the row may already be in Supabase.
    writeIds(PENDING_DELETES_KEY, [...readIds(PENDING_DELETES_KEY), id]);
  },

  clearUpserts: (ids: string[]): void => {
    const done = new Set(ids);
    writeIds(PENDING_UPSERTS_KEY, readIds(PENDING_UPSERTS_KEY).filter(x => !done.has(x)));
  },

  clearDeletes: (ids: string[]): void => {
    const done = new Set(ids);
    writeIds(PENDING_DELETES_KEY, readIds(PENDING_DELETES_KEY).filter(x => !done.has(x)));
  },

  pendingCount: (): number =>
    readIds(PENDING_UPSERTS_KEY).length + readIds(PENDING_DELETES_KEY).length,
};
