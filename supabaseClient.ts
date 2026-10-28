import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project credentials
export const DEFAULT_SUPABASE_URL = 'https://gnjewldavlktodaehrdm.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_5ChQOS9v5-iOCQzTEOwqtw_oPG03Tm_';

const STORAGE_URL_KEY = 'brasao_supabase_url';
const STORAGE_ANON_KEY = 'brasao_supabase_anon_key';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
  projectId: string;
}

export function extractProjectId(url: string): string {
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    return hostParts[0] || 'supabase';
  } catch {
    return 'supabase';
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  // 1. Check LocalStorage for custom user configuration
  if (typeof window !== 'undefined') {
    url = localStorage.getItem(STORAGE_URL_KEY)?.trim() || '';
    anonKey = localStorage.getItem(STORAGE_ANON_KEY)?.trim() || '';
  }

  // 2. Check Vite environment variables if not in localStorage
  if (!url) {
    url = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  }
  if (!anonKey) {
    anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  }

  const isCustom = Boolean(url && url !== DEFAULT_SUPABASE_URL);

  // 3. Fallback to default credentials
  if (!url) url = DEFAULT_SUPABASE_URL;
  if (!anonKey) anonKey = DEFAULT_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    isCustom,
    projectId: extractProjectId(url)
  };
}

let currentClient: SupabaseClient = createClient(
  getSupabaseConfig().url,
  getSupabaseConfig().anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

const listeners: Array<(client: SupabaseClient) => void> = [];

export function getSupabaseClient(): SupabaseClient {
  return currentClient;
}

// Proxy export for backwards compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = currentClient as any;
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export function saveSupabaseConfig(url: string, anonKey: string): SupabaseConfig {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
  localStorage.setItem(STORAGE_ANON_KEY, cleanKey);

  currentClient = createClient(cleanUrl, cleanKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  listeners.forEach(cb => {
    try { cb(currentClient); } catch (e) { console.error(e); }
  });

  return getSupabaseConfig();
}

export function resetSupabaseConfig(): SupabaseConfig {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);

  currentClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  listeners.forEach(cb => {
    try { cb(currentClient); } catch (e) { console.error(e); }
  });

  return getSupabaseConfig();
}

export function onSupabaseConfigChange(callback: (client: SupabaseClient) => void): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export interface ConnectionTestResult {
  connected: boolean;
  tableExists: boolean;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
  rowCount?: number;
  statusCode?: number;
}

// checkWrite=true inserts and deletes a temporary row. Only use it from the
// setup modal, never on every app load (it pollutes the table and realtime feed).
export async function testSupabaseConnection(
  overrideClient?: SupabaseClient,
  checkWrite = false
): Promise<ConnectionTestResult> {
  const client = overrideClient || currentClient;
  
  try {
    // 1. Test basic table read
    const { data, error, count, status } = await client
      .from('inventory')
      .select('id', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      // Check for table not found error codes (PGRST205 or 42P01)
      const isMissingTable = 
        error.code === 'PGRST205' || 
        error.code === '42P01' || 
        error.message?.toLowerCase().includes('not find the table') ||
        error.message?.toLowerCase().includes('relation "public.inventory" does not exist') ||
        error.message?.toLowerCase().includes('schema cache');

      return {
        connected: status !== 0 && status !== 500, // Reached Supabase REST API
        tableExists: !isMissingTable,
        canRead: false,
        canWrite: false,
        error: isMissingTable ? "Table 'public.inventory' not found in schema" : error.message,
        statusCode: status
      };
    }

    if (!checkWrite) {
      return {
        connected: true,
        tableExists: true,
        canRead: true,
        canWrite: true,
        rowCount: count ?? (data?.length || 0)
      };
    }

    // 2. Test write & delete with a valid UUID to confirm write permissions
    const testId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : '00000000-0000-0000-0000-000000000001';
    const testPayload = {
      id: testId,
      timestamp: Date.now(),
      itemName: 'Connection Test Item',
      location: 'Cellar',
      qty: 1
    };

    let canWrite = false;
    const { error: insertError } = await client
      .from('inventory')
      .insert([testPayload]);

    if (!insertError) {
      canWrite = true;
      // Clean up test entry
      await client.from('inventory').delete().eq('id', testId);
    } else {
      console.warn("Test insert warning (read works, write restricted):", insertError.message);
    }

    return {
      connected: true,
      tableExists: true,
      canRead: true,
      canWrite,
      rowCount: count ?? (data?.length || 0)
    };
  } catch (err: any) {
    return {
      connected: false,
      tableExists: false,
      canRead: false,
      canWrite: false,
      error: err.message || 'Network connection failed'
    };
  }
}
