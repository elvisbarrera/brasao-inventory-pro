import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LocationType, InventoryEntry, GroupedReport } from './types.ts';
import { supabaseService } from './services/supabaseService.ts';
import { getSupabaseClient, onSupabaseConfigChange, testSupabaseConnection } from './supabaseClient.ts';
import { storageService } from './services/storageService.ts';
import { MASTER_WINE_LIST } from './constants.tsx';
import InventoryForm from './components/InventoryForm.tsx';
import InventoryReport from './components/InventoryReport.tsx';
import { SupabaseModal } from './components/SupabaseModal.tsx';
import { 
  ClipboardList, 
  BarChart3, 
  Wine,
  Cloud,
  Loader2,
  RefreshCcw,
  Zap,
  CheckCircle2,
  Database,
  AlertTriangle,
  ArrowRight,
  HardDrive
} from 'lucide-react';

type SupabaseStatus = 'connected' | 'missing_table' | 'offline' | 'checking';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'count' | 'report'>('count');
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>('checking');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSupabaseStatus('checking');

      // Check table status
      const testRes = await testSupabaseConnection();

      if (testRes.connected && testRes.tableExists) {
        const data = await supabaseService.fetchEntries();
        setEntries(data);
        storageService.saveEntries(data);
        setSupabaseStatus('connected');
        setLastSynced(new Date());
      } else if (testRes.connected && !testRes.tableExists) {
        // Table does not exist in Supabase yet
        setSupabaseStatus('missing_table');
        const localData = storageService.getEntries();
        setEntries(localData);
      } else {
        // Supabase network unreachable
        setSupabaseStatus('offline');
        const localData = storageService.getEntries();
        setEntries(localData);
      }
    } catch (err: any) {
      console.warn("Supabase fetch warning:", err.message);
      if (err.code === 'TABLE_NOT_FOUND' || err.message?.includes('not found')) {
        setSupabaseStatus('missing_table');
      } else {
        setSupabaseStatus('offline');
      }
      // Fallback to local storage
      const localData = storageService.getEntries();
      setEntries(localData);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up Supabase Realtime subscription
  useEffect(() => {
    loadData();

    let channel: any = null;

    const setupRealtime = () => {
      const client = getSupabaseClient();
      if (channel) {
        try { client.removeChannel(channel); } catch (e) { /* ignore */ }
      }

      channel = client
        .channel('inventory-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory' },
          (payload) => {
            setLastSynced(new Date());
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as any;
              const mapped: InventoryEntry = {
                id: String(newRow.id),
                timestamp: Number(newRow.timestamp) || Date.now(),
                itemName: newRow.itemName ?? newRow.itemname ?? newRow.item_name ?? 'Item',
                location: newRow.location === 'Bar' ? LocationType.BAR : LocationType.CELLAR,
                qty: Number(newRow.qty) || 0
              };
              setEntries(prev => {
                if (prev.find(e => e.id === mapped.id)) return prev;
                const next = [mapped, ...prev];
                storageService.saveEntries(next);
                return next;
              });
            } else if (payload.eventType === 'DELETE') {
              setEntries(prev => {
                const next = prev.filter(e => e.id !== String(payload.old.id));
                storageService.saveEntries(next);
                return next;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedRow = payload.new as any;
              const mapped: InventoryEntry = {
                id: String(updatedRow.id),
                timestamp: Number(updatedRow.timestamp) || Date.now(),
                itemName: updatedRow.itemName ?? updatedRow.itemname ?? updatedRow.item_name ?? 'Item',
                location: updatedRow.location === 'Bar' ? LocationType.BAR : LocationType.CELLAR,
                qty: Number(updatedRow.qty) || 0
              };
              setEntries(prev => {
                const next = prev.map(e => e.id === mapped.id ? mapped : e);
                storageService.saveEntries(next);
                return next;
              });
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    const unsubscribeConfig = onSupabaseConfigChange(() => {
      setupRealtime();
      loadData();
    });

    return () => {
      unsubscribeConfig();
      if (channel) {
        getSupabaseClient().removeChannel(channel);
      }
    };
  }, [loadData]);

  const addEntry = async (entry: Omit<InventoryEntry, 'id' | 'timestamp'>) => {
    const tempId = crypto.randomUUID();
    const newEntry: InventoryEntry = {
      ...entry,
      id: tempId,
      timestamp: Date.now(),
    };

    setIsSyncing(true);

    if (supabaseStatus === 'connected') {
      try {
        setEntries(prev => {
          const next = [newEntry, ...prev];
          storageService.saveEntries(next);
          return next;
        });

        const savedEntry = await supabaseService.addEntry(newEntry);
        setEntries(prev => {
          const next = prev.map(e => e.id === tempId ? savedEntry : e);
          storageService.saveEntries(next);
          return next;
        });
        setLastSynced(new Date());
      } catch (err: any) {
        console.error("Cloud sync failed, keeping in local storage:", err.message);
        // Keep in local storage even if cloud temporary fails
        setError("Saved to local storage. Cloud error: " + err.message);
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Local fallback mode
      setEntries(prev => {
        const next = [newEntry, ...prev];
        storageService.saveEntries(next);
        return next;
      });
      setIsSyncing(false);
    }
  };

  const removeEntry = async (id: string) => {
    setIsSyncing(true);
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      storageService.saveEntries(next);
      return next;
    });

    if (supabaseStatus === 'connected') {
      try {
        await supabaseService.removeEntry(id);
        setLastSynced(new Date());
      } catch (err: any) {
        setError(err.message);
        loadData();
      } finally {
        setIsSyncing(false);
      }
    } else {
      setIsSyncing(false);
    }
  };

  const updateEntry = async (id: string, updatedFields: Partial<InventoryEntry>) => {
    setIsSyncing(true);
    setEntries(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...updatedFields } : e);
      storageService.saveEntries(next);
      return next;
    });

    if (supabaseStatus === 'connected') {
      try {
        await supabaseService.updateEntry(id, updatedFields);
        setLastSynced(new Date());
      } catch (err: any) {
        setError(err.message);
        loadData();
      } finally {
        setIsSyncing(false);
      }
    } else {
      setIsSyncing(false);
    }
  };

  const clearInventory = async () => {
    if (window.confirm("WARNING: This will delete all inventory records. Proceed?")) {
      try {
        setIsSyncing(true);
        setEntries([]);
        storageService.clearAll();

        if (supabaseStatus === 'connected') {
          await supabaseService.clearAll();
        }
        setLastSynced(new Date());
      } catch (err: any) {
        setError(err.message);
        loadData();
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const groupedReport = useMemo(() => {
    const reportMap = new Map<string, { cellar: number; bar: number }>();
    entries.forEach(entry => {
      const current = reportMap.get(entry.itemName) || { cellar: 0, bar: 0 };
      if (entry.location === LocationType.CELLAR) {
        current.cellar += entry.qty;
      } else {
        current.bar += entry.qty;
      }
      reportMap.set(entry.itemName, current);
    });

    const result: GroupedReport[] = [];
    reportMap.forEach((vals, name) => {
      const masterItem = MASTER_WINE_LIST.find(w => w.name === name);
      const priceStr = masterItem?.price?.replace(/[^0-9.]/g, '') || "0";
      const priceNum = parseFloat(priceStr);
      const totalQty = vals.cellar + vals.bar;
      const isLiquor = masterItem?.category?.toLowerCase().includes('liquor');
      const pourMultiplier = isLiquor ? 25 : 1;

      result.push({
        name,
        category: masterItem?.category || "Uncategorized",
        price: priceNum,
        cellarQty: vals.cellar,
        barQty: vals.bar,
        totalQty: totalQty,
        totalValue: priceNum * pourMultiplier * totalQty
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-40 shadow-lg border-b border-slate-800">
        <div className="max-w-lg mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wine size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none text-white">Brasão Inventory Pro</h1>
              {lastSynced ? (
                <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                  Synced: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              ) : (
                <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                  Wine & Bar Management
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Supabase Status Chip / Modal Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                supabaseStatus === 'connected'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : supabaseStatus === 'missing_table'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 animate-pulse hover:bg-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Click to view Supabase database connection and SQL setup"
            >
              {supabaseStatus === 'connected' ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Supabase Live</span>
                </>
              ) : supabaseStatus === 'missing_table' ? (
                <>
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span>Setup DB</span>
                </>
              ) : (
                <>
                  <Database size={12} className="text-slate-400" />
                  <span>Local Mode</span>
                </>
              )}
            </button>

            {isSyncing ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded-full animate-pulse">
                <RefreshCcw size={10} className="text-indigo-300 animate-spin" />
              </div>
            ) : supabaseStatus === 'connected' && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-indigo-600/30 border border-indigo-400/40 rounded-full">
                <Zap size={10} className="text-indigo-400 fill-indigo-400" />
                <span className="text-[8px] font-bold uppercase text-indigo-200">Realtime</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 pt-4 pb-6 max-w-lg mx-auto w-full">
        {/* Missing Table / Setup Callout */}
        {supabaseStatus === 'missing_table' && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm text-amber-950 space-y-2.5 animate-in fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
                  <Database size={16} />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                  Supabase Table Setup Required
                </h3>
              </div>
              <span className="text-[10px] bg-amber-200/60 font-bold px-2 py-0.5 rounded-full text-amber-800">
                Action Needed
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Supabase is connected, but table <code className="font-mono bg-amber-100 px-1 py-0.5 rounded font-bold">public.inventory</code> has not been created yet. Entries are currently saved in local storage.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <span>Open 1-Click SQL Setup & Instructions</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Offline Banner */}
        {supabaseStatus === 'offline' && (
          <div className="mb-4 p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-slate-500" />
              <span>Working in <strong>Local Storage Mode</strong></span>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-bold text-indigo-600 hover:underline shrink-0"
            >
              Connect DB
            </button>
          </div>
        )}

        {/* Error notification if any */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2">
            <p className="font-medium leading-relaxed">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="text-red-500 hover:text-red-700 font-bold text-xs shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-300">
            <div className="relative">
              <Loader2 className="animate-spin text-indigo-500" size={44} />
              <Cloud className="absolute inset-0 m-auto text-indigo-200" size={18} />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Connecting to Database</p>
          </div>
        ) : activeTab === 'count' ? (
          <InventoryForm 
            onAdd={addEntry} 
            onOCRResults={(results) => {
              results.forEach(res => {
                addEntry({
                  itemName: res.name,
                  qty: res.qty,
                  location: LocationType.CELLAR
                });
              });
            }} 
          />
        ) : (
          <InventoryReport 
            report={groupedReport} 
            rawEntries={entries}
            onClear={clearInventory}
            onRemoveEntry={removeEntry}
            onUpdateEntry={updateEntry}
          />
        )}
      </main>

      {/* Supabase Connection & Setup Modal */}
      <SupabaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectionSuccess={() => {
          loadData();
        }}
        entriesCount={entries.length}
      />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-8 py-3 flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30">
        <button 
          onClick={() => setActiveTab('count')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'count' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'count' ? 'bg-indigo-50' : 'bg-transparent'}`}>
            <ClipboardList size={22} strokeWidth={activeTab === 'count' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Entry</span>
        </button>
        <button 
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${activeTab === 'report' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'report' ? 'bg-indigo-50' : 'bg-transparent'}`}>
            <BarChart3 size={22} strokeWidth={activeTab === 'report' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Reports</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
