import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public project credentials (publishable key, safe in the browser).
// Override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY or from the Settings sheet.
export const DEFAULT_SUPABASE_URL = 'https://gnjewldavlktodaehrdm.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_5ChQOS9v5-iOCQzTEOwqtw_oPG03Tm_';

const STORAGE_URL_KEY = 'brasao_supabase_url';
const STORAGE_ANON_KEY = 'brasao_supabase_anon_key';

export const TABLE = 'inventory';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
  projectId: string;
}

const projectIdFrom = (url: string) => {
  try {
    return new URL(url).hostname.split('.')[0] || 'supabase';
  } catch {
    return 'supabase';
  }
};

export function getSupabaseConfig(): SupabaseConfig {
  const stored = (key: string) => {
    try {
      return localStorage.getItem(key)?.trim() || '';
    } catch {
      return '';
    }
  };
  const url = stored(STORAGE_URL_KEY) || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = stored(STORAGE_ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return { url, anonKey, isCustom: url !== DEFAULT_SUPABASE_URL, projectId: projectIdFrom(url) };
}

const build = (url: string, key: string) =>
  createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

let client: SupabaseClient = build(getSupabaseConfig().url, getSupabaseConfig().anonKey);
const listeners = new Set<() => void>();

export const getSupabase = () => client;

export function onSupabaseConfigChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function replaceClient(url: string, key: string) {
  client.removeAllChannels();
  client = build(url, key);
  listeners.forEach(cb => cb());
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
  localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  replaceClient(cleanUrl, anonKey.trim());
  return getSupabaseConfig();
}

export function resetSupabaseConfig() {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);
  const cfg = getSupabaseConfig();
  replaceClient(cfg.url, cfg.anonKey);
  return cfg;
}

export type ConnectionState = 'connected' | 'missing_table' | 'offline';

export interface ConnectionTest {
  state: ConnectionState;
  rowCount?: number;
  canWrite?: boolean;
  error?: string;
}

const isMissingTable = (code?: string, message = '') =>
  code === 'PGRST205' ||
  code === '42P01' ||
  /not find the table|does not exist|schema cache/i.test(message);

/**
 * Lightweight read check. `checkWrite` inserts and removes a temporary row,
 * so only use it from the Settings sheet, never on every load.
 */
export async function testConnection(checkWrite = false): Promise<ConnectionTest> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { state: 'offline', error: 'No connection' };
  try {
    // retry(false): fail fast when offline; the sync loop does its own retries
    const { count, error } = await client.from(TABLE).select('id', { count: 'exact', head: true }).retry(false);
    if (error) {
      if (isMissingTable(error.code, error.message)) return { state: 'missing_table', error: error.message };
      // Supabase returns an error object with an empty message when the network fails
      return { state: 'offline', error: error.message || 'No connection' };
    }
    if (!checkWrite) return { state: 'connected', rowCount: count ?? 0 };

    const id = crypto.randomUUID();
    const { error: insertError } = await client
      .from(TABLE)
      .insert([{ id, timestamp: Date.now(), itemName: '__connection_test__', location: 'Cellar', qty: 0 }]);
    if (!insertError) await client.from(TABLE).delete().eq('id', id);
    return { state: 'connected', rowCount: count ?? 0, canWrite: !insertError, error: insertError?.message };
  } catch (err) {
    return { state: 'offline', error: err instanceof Error ? err.message : 'No connection' };
  }
}

export const SQL_SETUP_SCRIPT = `-- Brasão Inventory Pro: run once in Supabase → SQL Editor
CREATE TABLE IF NOT EXISTS public.inventory (
  id TEXT PRIMARY KEY,
  timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  "itemName" TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('Cellar', 'Bar')),
  qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_inventory_timestamp ON public.inventory(timestamp DESC);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory read" ON public.inventory;
DROP POLICY IF EXISTS "inventory insert" ON public.inventory;
DROP POLICY IF EXISTS "inventory update" ON public.inventory;
DROP POLICY IF EXISTS "inventory delete" ON public.inventory;
CREATE POLICY "inventory read" ON public.inventory FOR SELECT TO public USING (true);
CREATE POLICY "inventory insert" ON public.inventory FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "inventory update" ON public.inventory FOR UPDATE TO public USING (true);
CREATE POLICY "inventory delete" ON public.inventory FOR DELETE TO public USING (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  END IF;
END $$;`;
