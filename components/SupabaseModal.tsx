import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Settings2, 
  UploadCloud, 
  FileCode, 
  ChevronDown, 
  ChevronUp, 
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  resetSupabaseConfig, 
  testSupabaseConnection, 
  ConnectionTestResult, 
  DEFAULT_SUPABASE_URL, 
  DEFAULT_SUPABASE_ANON_KEY 
} from '../supabaseClient.ts';
import { supabaseService } from '../services/supabaseService.ts';
import { storageService } from '../services/storageService.ts';
import { InventoryEntry, LocationType } from '../types.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess?: () => void;
  entriesCount?: number;
}

export const SQL_SETUP_SCRIPT = `-- =========================================================
-- Brasão Inventory Pro - Supabase Database Schema
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================

-- 1. Create the inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    "itemName" TEXT NOT NULL,
    itemname TEXT GENERATED ALWAYS AS ("itemName") STORED,
    location TEXT NOT NULL CHECK (location IN ('Cellar', 'Bar')),
    qty NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_inventory_timestamp ON public.inventory(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON public.inventory(location);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Public Access (Anon key)
DROP POLICY IF EXISTS "Allow public read access" ON public.inventory;
CREATE POLICY "Allow public read access" 
ON public.inventory FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.inventory;
CREATE POLICY "Allow public insert access" 
ON public.inventory FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.inventory;
CREATE POLICY "Allow public update access" 
ON public.inventory FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Allow public delete access" ON public.inventory;
CREATE POLICY "Allow public delete access" 
ON public.inventory FOR DELETE TO public USING (true);

-- 5. Enable Realtime updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  END IF;
END $$;
`;

const SAMPLE_ENTRIES: Omit<InventoryEntry, 'id' | 'timestamp'>[] = [
  { itemName: "1209 Duckhorn Cabernet", location: LocationType.CELLAR, qty: 12 },
  { itemName: "1207 Caymus Cabernet", location: LocationType.CELLAR, qty: 8 },
  { itemName: "1141 Sea Sun", location: LocationType.CELLAR, qty: 15 },
  { itemName: "1110 Moët & Chandon Imperial", location: LocationType.CELLAR, qty: 6 },
  { itemName: "Macallan 12 Double Cask", location: LocationType.BAR, qty: 2.75 },
  { itemName: "Woodford Reserve Bourbon", location: LocationType.BAR, qty: 1.5 },
  { itemName: "Grey Goose Vodka", location: LocationType.BAR, qty: 3.25 },
];

export const SupabaseModal: React.FC<Props> = ({ isOpen, onClose, onConnectionSuccess, entriesCount = 0 }) => {
  const [config, setConfig] = useState(getSupabaseConfig());
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [showCustomConfig, setShowCustomConfig] = useState(false);
  
  // Custom input state
  const [customUrl, setCustomUrl] = useState(config.url);
  const [customAnonKey, setCustomAnonKey] = useState(config.anonKey);
  const [configSavedMessage, setConfigSavedMessage] = useState<string | null>(null);
  
  // Sync state
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const runTest = async () => {
    setIsTesting(true);
    setActionMessage(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      if (res.connected && res.tableExists) {
        onConnectionSuccess?.();
      }
    } catch (err: any) {
      setTestResult({
        connected: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        error: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setConfig(getSupabaseConfig());
      setCustomUrl(getSupabaseConfig().url);
      setCustomAnonKey(getSupabaseConfig().anonKey);
      runTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveCustomConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customAnonKey.trim()) {
      alert("Please provide both Supabase URL and Anon Key.");
      return;
    }
    const updated = saveSupabaseConfig(customUrl, customAnonKey);
    setConfig(updated);
    setConfigSavedMessage("Credentials saved successfully! Testing connection...");
    setTimeout(() => setConfigSavedMessage(null), 3000);
    await runTest();
  };

  const handleResetConfig = async () => {
    const updated = resetSupabaseConfig();
    setConfig(updated);
    setCustomUrl(updated.url);
    setCustomAnonKey(updated.anonKey);
    setConfigSavedMessage("Reset to default project credentials.");
    setTimeout(() => setConfigSavedMessage(null), 3000);
    await runTest();
  };

  const handleSyncLocalData = async () => {
    const local = storageService.getEntries();
    if (local.length === 0) {
      setActionMessage("No local entries found to upload.");
      return;
    }

    setIsSyncingLocal(true);
    setActionMessage(null);
    try {
      const { added, errors } = await supabaseService.syncLocalToCloud(local);
      setActionMessage(`Uploaded ${added} items to Supabase cloud! ${errors > 0 ? `(${errors} failed)` : ''}`);
      await runTest();
      onConnectionSuccess?.();
    } catch (err: any) {
      setActionMessage(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const handleSeedSampleData = async () => {
    setIsSeeding(true);
    setActionMessage(null);
    try {
      let count = 0;
      for (const item of SAMPLE_ENTRIES) {
        await supabaseService.addEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now() - (count * 60000),
          itemName: item.itemName,
          location: item.location,
          qty: item.qty
        });
        count++;
      }
      setActionMessage(`Added ${count} sample items to Supabase!`);
      await runTest();
      onConnectionSuccess?.();
    } catch (err: any) {
      setActionMessage(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const isConnectedAndReady = testResult?.connected && testResult?.tableExists;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Database size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Supabase Database Connection</h2>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                Project: <span className="text-emerald-300 font-mono font-semibold">{config.projectId}</span>
                {config.isCustom && <span className="bg-indigo-500/30 text-indigo-200 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">Custom</span>}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-700 text-sm">
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            isConnectedAndReady
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : testResult?.connected && !testResult.tableExists
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="mt-0.5 shrink-0">
              {isTesting ? (
                <RefreshCw size={20} className="animate-spin text-indigo-600" />
              ) : isConnectedAndReady ? (
                <CheckCircle2 size={20} className="text-emerald-600" />
              ) : testResult?.connected && !testResult.tableExists ? (
                <AlertTriangle size={20} className="text-amber-600" />
              ) : (
                <XCircle size={20} className="text-red-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-xs uppercase tracking-wider">
                  {isTesting 
                    ? 'Testing Connection...' 
                    : isConnectedAndReady 
                    ? 'Supabase Database Active' 
                    : testResult?.connected && !testResult.tableExists 
                    ? 'Connected, But Table Needs Setup' 
                    : 'Connection Error'}
                </p>
                <button
                  onClick={runTest}
                  disabled={isTesting}
                  className="text-xs font-semibold underline hover:opacity-80 flex items-center gap-1 shrink-0"
                >
                  <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
                  Re-test
                </button>
              </div>

              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {isTesting ? (
                  'Verifying endpoints and querying table public.inventory...'
                ) : isConnectedAndReady ? (
                  `Connected and synchronized! Ready to store and query inventory live in Supabase.`
                ) : testResult?.connected && !testResult.tableExists ? (
                  `Successfully reached Supabase API, but the 'public.inventory' table does not exist yet. Run the SQL script below to create it in 5 seconds.`
                ) : (
                  testResult?.error || 'Unable to reach the Supabase endpoint. Check your internet connection or credentials.'
                )}
              </p>
            </div>
          </div>

          {actionMessage && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-900 flex items-center justify-between animate-in fade-in">
              <span>{actionMessage}</span>
              <button onClick={() => setActionMessage(null)} className="text-indigo-400 hover:text-indigo-700">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Table Creation Guide & SQL Script */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-indigo-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  SQL Setup Script (1-Click)
                </h3>
              </div>
              <button 
                onClick={handleCopySql}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'SQL Copied!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Creates table <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px] font-bold">public.inventory</code>, configures Row Level Security (RLS) policies for anonymous read/write, and enables Realtime sync.
            </p>

            {/* Steps */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-800 uppercase tracking-tighter text-[11px]">How to apply in 3 steps:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-xs">
                <li>
                  Click the <strong>Copy SQL Script</strong> button above.
                </li>
                <li>
                  Open your <a 
                    href={`https://supabase.com/dashboard/project/${config.projectId}/sql/new`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-semibold underline inline-flex items-center gap-1"
                  >
                    Supabase SQL Editor <ExternalLink size={10} />
                  </a>.
                </li>
                <li>
                  Paste into the editor and click <strong>Run</strong> (or press <kbd className="bg-slate-100 border px-1 rounded text-[10px]">Ctrl+Enter</kbd> / <kbd className="bg-slate-100 border px-1 rounded text-[10px]">Cmd+Enter</kbd>).
                </li>
              </ol>
            </div>

            {/* Collapsible Script Preview */}
            <div>
              <button 
                type="button"
                onClick={() => setShowSqlPreview(!showSqlPreview)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                {showSqlPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showSqlPreview ? 'Hide SQL Code' : 'Preview SQL Code'}
              </button>
              
              {showSqlPreview && (
                <div className="mt-2 relative">
                  <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] font-mono rounded-lg overflow-x-auto max-h-48 border border-slate-800 leading-snug">
                    {SQL_SETUP_SCRIPT}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Seeding (when connected) */}
          {isConnectedAndReady && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Data & Inventory Tools
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSeedSampleData}
                  disabled={isSeeding}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl font-bold text-xs hover:bg-emerald-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                >
                  <Layers size={14} />
                  <span>{isSeeding ? 'Adding...' : 'Add Sample Stock'}</span>
                </button>

                <button
                  onClick={handleSyncLocalData}
                  disabled={isSyncingLocal}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                >
                  <UploadCloud size={14} />
                  <span>{isSyncingLocal ? 'Syncing...' : 'Sync Local to Cloud'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Custom Supabase Project Credentials */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCustomConfig(!showCustomConfig)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-slate-500" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Custom Supabase Project Settings
                </span>
              </div>
              {showCustomConfig ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showCustomConfig && (
              <form onSubmit={handleSaveCustomConfig} className="p-4 space-y-3 bg-white border-t border-slate-200">
                {configSavedMessage && (
                  <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    {configSavedMessage}
                  </p>
                )}

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Supabase Project URL
                  </label>
                  <input 
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Supabase Anon Public API Key
                  </label>
                  <input 
                    type="text"
                    value={customAnonKey}
                    onChange={(e) => setCustomAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Save & Reconnect
                  </button>
                  {config.isCustom && (
                    <button
                      type="button"
                      onClick={handleResetConfig}
                      className="px-3 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {entriesCount > 0 ? (
              <span><strong>{entriesCount}</strong> entries in current view</span>
            ) : (
              <span>Inventory Database Ready</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
