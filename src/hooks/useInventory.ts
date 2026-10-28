import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, onSupabaseConfigChange, testConnection, TABLE } from '@/lib/supabase';
import { inventoryApi, rowToEntry, TableMissingError, TEST_ITEM_NAMES } from '@/services/inventoryApi';
import { localStore } from '@/services/localStore';
import type { InventoryEntry, NewEntry } from '@/types';

export type SyncStatus = 'checking' | 'connected' | 'missing_table' | 'offline';

const RETRY_MS = 20_000;
const CHECK_TIMEOUT_MS = 8_000;

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

const byNewest = (a: InventoryEntry, b: InventoryEntry) => b.timestamp - a.timestamp;

/**
 * Offline-first inventory state.
 * - Every change is written to the device and queued.
 * - sync() uploads the queue (upsert/delete), then pulls and merges the cloud copy.
 * - Nothing local is dropped until Supabase has confirmed it.
 */
export function useInventory() {
  const [entries, setEntries] = useState<InventoryEntry[]>(() => localStore.getEntries());
  const [status, setStatus] = useState<SyncStatus>('checking');
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(() => localStore.pendingCount());
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const running = useRef(false);
  const rerun = useRef(false);

  const commit = useCallback((updater: (prev: InventoryEntry[]) => InventoryEntry[]) => {
    setEntries(prev => {
      const next = updater(prev);
      localStore.saveEntries(next);
      return next;
    });
    setPending(localStore.pendingCount());
  }, []);

  const sync = useCallback(async () => {
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      const check = await withTimeout(testConnection(), CHECK_TIMEOUT_MS);
      if (check.state !== 'connected') {
        setStatus(check.state);
        return;
      }

      // 1. Push creates/edits
      const upIds = localStore.pendingUpserts();
      if (upIds.length) {
        const local = localStore.getEntries();
        const present = new Set(local.map(e => e.id));
        const saved = await inventoryApi.upsert(local.filter(e => upIds.includes(e.id)));
        localStore.clearUpserts([...saved, ...upIds.filter(id => !present.has(id))]);
      }

      // 2. Push deletes
      const delIds = localStore.pendingDeletes();
      if (delIds.length) localStore.clearDeletes(await inventoryApi.remove(delIds));

      // 3. Pull + merge
      const cloud = await inventoryApi.fetchAll();
      const junk = cloud.filter(e => TEST_ITEM_NAMES.has(e.itemName)).map(e => e.id);
      if (junk.length) inventoryApi.remove(junk).catch(() => undefined);

      commit(prev => {
        const pendingUp = new Set(localStore.pendingUpserts());
        const pendingDel = new Set(localStore.pendingDeletes());
        return [
          ...prev.filter(e => pendingUp.has(e.id)),
          ...cloud.filter(e => !pendingUp.has(e.id) && !pendingDel.has(e.id) && !TEST_ITEM_NAMES.has(e.itemName)),
        ].sort(byNewest);
      });

      setStatus('connected');
      setLastSynced(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof TableMissingError) setStatus('missing_table');
      else if (err instanceof Error && err.message === 'timeout') setStatus('offline');
      else setError(`Sync failed, will retry: ${err instanceof Error ? err.message : err}`);
    } finally {
      setPending(localStore.pendingCount());
      setSyncing(false);
      running.current = false;
      if (rerun.current) {
        rerun.current = false;
        setTimeout(sync, 0);
      }
    }
  }, [commit]);

  // Initial load, realtime feed, retries
  useEffect(() => {
    sync();

    let channel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;
    const subscribe = () => {
      const client = getSupabase();
      if (channel) client.removeChannel(channel);
      channel = client
        .channel('inventory-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, payload => {
          setLastSynced(new Date());
          if (payload.eventType === 'DELETE') {
            const id = String((payload.old as { id?: unknown }).id);
            commit(prev => prev.filter(e => e.id !== id));
            return;
          }
          const entry = rowToEntry(payload.new as Record<string, unknown>);
          if (TEST_ITEM_NAMES.has(entry.itemName)) return;
          if (localStore.pendingDeletes().includes(entry.id)) return;
          if (localStore.pendingUpserts().includes(entry.id)) return; // local edit wins until uploaded
          commit(prev =>
            prev.some(e => e.id === entry.id)
              ? prev.map(e => (e.id === entry.id ? entry : e))
              : [entry, ...prev].sort(byNewest),
          );
        })
        .subscribe();
    };
    subscribe();

    const offConfig = onSupabaseConfigChange(() => {
      subscribe();
      sync();
    });
    const onOnline = () => sync();
    const onOffline = () => setStatus('offline');
    const onVisible = () => document.visibilityState === 'visible' && sync();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (localStore.pendingCount() > 0) sync();
    }, RETRY_MS);

    return () => {
      offConfig();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      if (channel) getSupabase().removeChannel(channel);
    };
  }, [sync, commit]);

  // ---- Mutations: local first, then queue + sync ----

  const add = useCallback(
    (items: NewEntry[]) => {
      if (items.length === 0) return;
      const now = Date.now();
      const created = items.map((item, i) => ({ ...item, id: crypto.randomUUID(), timestamp: now - i }));
      localStore.markUpsert(created.map(e => e.id));
      commit(prev => [...created, ...prev]);
      sync();
    },
    [commit, sync],
  );

  const update = useCallback(
    (id: string, changes: Partial<NewEntry>) => {
      localStore.markUpsert([id]);
      commit(prev => prev.map(e => (e.id === id ? { ...e, ...changes } : e)));
      sync();
    },
    [commit, sync],
  );

  const remove = useCallback(
    (id: string) => {
      localStore.markDelete(id);
      commit(prev => prev.filter(e => e.id !== id));
      sync();
    },
    [commit, sync],
  );

  /** Wipes the whole inventory. Requires a live connection. */
  const clearAll = useCallback(async () => {
    if (status !== 'connected') throw new Error('You need a connection to clear the inventory.');
    await inventoryApi.clearAll();
    localStore.clearAll();
    setEntries([]);
    setPending(0);
    setLastSynced(new Date());
  }, [status]);

  return {
    entries,
    status,
    syncing,
    pending,
    lastSynced,
    error,
    dismissError: () => setError(null),
    sync,
    add,
    update,
    remove,
    clearAll,
  };
}

export type Inventory = ReturnType<typeof useInventory>;
