import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Loader2, 
  RefreshCcw, 
  Database,
  ArrowRight,
  HardDrive
} from 'lucide-react';

type SupabaseStatus = 'connected' | 'missing_table' | 'offline' | 'checking';

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'count' | 'report'>('count');
  const [entries, setEntries] = useState<InventoryEntry[]>(() => {
    try {
      return storageService.getEntries() || [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>('checking');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [pendingCount, setPendingCount] = useState<number>(() => storageService.pendingCount());

  const syncingRef = useRef(false);
  const rerunRef = useRef(false);

  const TEST_ITEM_NAME = 'Connection Test Item';

  /**
   * Single sync routine (safe to call any time):
   * 1. push local changes that are still pending (upsert = idempotent)
   * 2. push pending deletes
   * 3. pull the cloud copy and merge, keeping anything still pending locally
   * Nothing local is ever discarded until Supabase has confirmed it.
   */
  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      rerunRef.current = true;
      return;
    }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const test = await withTimeout(testSupabaseConnection(), 10000);
      if (!test.connected) {
        setSupabaseStatus('offline');
        return;
      }
      if (!test.tableExists) {
        setSupabaseStatus('missing_table');
        return;
      }

      // 1. Upload pending creates/edits
      const upIds = storageService.getPendingUpserts();
      if (upIds.length) {
        const local = storageService.getEntries();
        const toUpload = local.filter(e => upIds.includes(e.id));
        const saved = await supabaseService.upsertEntries(toUpload);
        // ids that are no longer in local storage are also done
        const orphans = upIds.filter(id => !local.some(e => e.id === id));
        storageService.clearUpserts([...saved, ...orphans]);
      }

      // 2. Upload pending deletes
      const delIds = storageService.getPendingDeletes();
      if (delIds.length) {
        const removed = await supabaseService.removeEntries(delIds);
        storageService.clearDeletes(removed);
      }

      // 3. Pull + merge
      const cloud = await supabaseService.fetchEntries();

      // Clean up leftover rows from the old connection test
      const junk = cloud.filter(e => e.itemName === TEST_ITEM_NAME).map(e => e.id);
      if (junk.length) supabaseService.removeEntries(junk).catch(() => {});

      setEntries(prev => {
        const pendingUp = new Set(storageService.getPendingUpserts());
        const pendingDel = new Set(storageService.getPendingDeletes());
        const localPending = prev.filter(e => pendingUp.has(e.id));
        const merged = [
          ...localPending,
          ...cloud.filter(e => !pendingUp.has(e.id) && !pendingDel.has(e.id) && e.itemName !== TEST_ITEM_NAME),
        ].sort((a, b) => b.timestamp - a.timestamp);
        storageService.saveEntries(merged);
        return merged;
      });

      setSupabaseStatus('connected');
      setLastSynced(new Date());
      setError(null);
    } catch (err: any) {
      console.warn('Sync failed, data kept on this device:', err?.message);
      if (err?.code === 'TABLE_NOT_FOUND') setSupabaseStatus('missing_table');
      else if (err?.message === 'timeout') setSupabaseStatus('offline');
      else setError('No se pudo sincronizar (se reintentará): ' + err?.message);
    } finally {
      setPendingCount(storageService.pendingCount());
      setIsSyncing(false);
      setLoading(false);
      syncingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        setTimeout(() => syncNow(), 0);
      }
    }
  }, []);

  const loadData = syncNow;

  useEffect(() => {
    setLoading(true);
    syncNow();

    let channel: any = null;

    const toEntry = (row: any): InventoryEntry => ({
      id: String(row.id),
      timestamp: Number(row.timestamp) || Date.now(),
      itemName: row.itemName ?? row.itemname ?? row.item_name ?? 'Item',
      location: row.location === 'Bar' ? LocationType.BAR : LocationType.CELLAR,
      qty: Number(row.qty) || 0,
    });

    const setupRealtime = () => {
      const client = getSupabaseClient();
      if (channel) {
        try { client.removeChannel(channel); } catch { /* ignore */ }
      }
      channel = client
        .channel('inventory-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload: any) => {
          setLastSynced(new Date());
          const pendingDel = new Set(storageService.getPendingDeletes());
          if (payload.eventType === 'DELETE') {
            const id = String(payload.old?.id);
            setEntries(prev => {
              const next = prev.filter(e => e.id !== id);
              storageService.saveEntries(next);
              return next;
            });
            return;
          }
          const mapped = toEntry(payload.new);
          if (mapped.itemName === TEST_ITEM_NAME || pendingDel.has(mapped.id)) return;
          // Don't overwrite a local edit that hasn't been uploaded yet
          if (storageService.getPendingUpserts().includes(mapped.id)) return;
          setEntries(prev => {
            const exists = prev.some(e => e.id === mapped.id);
            const next = exists ? prev.map(e => (e.id === mapped.id ? mapped : e)) : [mapped, ...prev];
            storageService.saveEntries(next);
            return next;
          });
        })
        .subscribe();
    };

    setupRealtime();

    const unsubscribeConfig = onSupabaseConfigChange(() => {
      setupRealtime();
      syncNow();
    });

    // Retry whenever we come back online / to the app, and every 20s while something is pending
    const onOnline = () => syncNow();
    const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => {
      if (storageService.pendingCount() > 0) syncNow();
    }, 20000);

    return () => {
      unsubscribeConfig();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
      if (channel) getSupabaseClient().removeChannel(channel);
    };
  }, [syncNow]);

  // Every change is saved on the device first and queued; syncNow uploads it.
  const addEntries = (items: Omit<InventoryEntry, 'id' | 'timestamp'>[]) => {
    if (items.length === 0) return;
    const now = Date.now();
    const newEntries: InventoryEntry[] = items.map((item, i) => ({
      ...item,
      id: crypto.randomUUID(),
      timestamp: now - i, // keep scan order stable
    }));
    newEntries.forEach(e => storageService.markUpsert(e.id));
    setEntries(prev => {
      const next = [...newEntries, ...prev];
      storageService.saveEntries(next);
      return next;
    });
    setPendingCount(storageService.pendingCount());
    syncNow();
  };

  const addEntry = (entry: Omit<InventoryEntry, 'id' | 'timestamp'>) => addEntries([entry]);

  const removeEntry = (id: string) => {
    storageService.markDelete(id);
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      storageService.saveEntries(next);
      return next;
    });
    setPendingCount(storageService.pendingCount());
    syncNow();
  };

  const updateEntry = (id: string, updatedFields: Partial<InventoryEntry>) => {
    storageService.markUpsert(id);
    setEntries(prev => {
      const next = prev.map(e => (e.id === id ? { ...e, ...updatedFields, id } : e));
      storageService.saveEntries(next);
      return next;
    });
    setPendingCount(storageService.pendingCount());
    syncNow();
  };

  const clearInventory = async () => {
    if (supabaseStatus !== 'connected') {
      alert('Necesitas conexión a la base de datos para borrar todo el inventario.');
      return;
    }
    if (!window.confirm('¿Seguro que deseas eliminar todos los registros de inventario?')) return;
    try {
      setIsSyncing(true);
      await supabaseService.clearAll();
      storageService.clearAll();
      setEntries([]);
      setPendingCount(0);
      setLastSynced(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
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
    <div className="flex flex-col min-h-screen bg-[#f8f9fb] text-slate-800 antialiased">
      {/* Luxury Brasão Navigation Header */}
      <header className="bg-[#0b0e14] text-white sticky top-0 z-40 shadow-xl border-b border-amber-500/20 backdrop-blur-md">
        <div className="max-w-lg md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <img 
              src="/brasao-logo.png" 
              alt="Brasão" 
              className="h-7 sm:h-8 md:h-9 w-auto object-contain brightness-0 invert drop-shadow-[0_2px_10px_rgba(212,175,55,0.35)] shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://images.squarespace-cdn.com/content/v1/60a7361067fec93537b3c527/5ced286e-5920-45e7-baee-ee8e1f6b55db/Brasa%CC%83o-LOGO-2024-Website-nopadding.png?format=500w";
              }}
            />
            <div className="border-l border-slate-700/70 pl-2.5 sm:pl-3 flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] sm:text-[15px] font-extrabold tracking-[0.16em] text-amber-200/95 font-montserrat truncate">
                  INVENTORY PRO
                </span>
                <span className="hidden sm:inline-block text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-montserrat">
                  Wine & Bar
                </span>
              </div>
              {lastSynced && (
                <p className="text-[8px] sm:text-[9px] text-slate-400 font-medium truncate">
                  Sincronizado: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          
          {/* Controls: Compact Live Pill & Status */}
          <div className="flex items-center gap-2 shrink-0">
            {isSyncing && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
                <RefreshCcw size={10} className="text-amber-400 animate-spin" />
              </div>
            )}

            {/* Smaller Supabase Status Pill as requested */}
            <button
              onClick={() => setIsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-semibold tracking-wide transition-all active:scale-95 shadow-sm ${
                supabaseStatus === 'connected'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : supabaseStatus === 'missing_table'
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Configuración de base de datos Supabase"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                supabaseStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse' :
                supabaseStatus === 'missing_table' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'
              }`} />
              <span className="font-bold">
                {supabaseStatus === 'connected' ? 'Live' : supabaseStatus === 'missing_table' ? 'Setup DB' : supabaseStatus === 'checking' ? '…' : 'Local'}
                {pendingCount > 0 && ` · ${pendingCount} sin subir`}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Container */}
      <main className="flex-1 px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-6 pb-24 sm:pb-28 max-w-lg md:max-w-4xl lg:max-w-6xl mx-auto w-full transition-all">
        {/* Missing Table Warning */}
        {supabaseStatus === 'missing_table' && (
          <div className="mb-4 p-3.5 sm:p-4 bg-amber-50/90 border border-amber-300 rounded-2xl shadow-sm text-amber-950 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-200/60 rounded-lg text-amber-800">
                  <Database size={16} />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                  Configuración de tabla requerida en Supabase
                </h3>
              </div>
              <span className="text-[10px] bg-amber-200 font-bold px-2 py-0.5 rounded-full text-amber-900">
                1 Clic
              </span>
            </div>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              Supabase está conectado, pero falta ejecutar el script de la tabla <code className="font-mono bg-amber-200/50 px-1 py-0.5 rounded font-bold">public.inventory</code>. Las botellas se guardan temporalmente en tu dispositivo.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
            >
              <span>Abrir script SQL y verificación en 1 clic</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Offline Notice */}
        {supabaseStatus === 'offline' && (
          <div className="mb-4 p-3 bg-white border border-slate-200 rounded-xl text-slate-700 flex items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <HardDrive size={15} className="text-slate-500" />
              <span>
                Sin conexión: se guarda en este dispositivo
                {pendingCount > 0 ? ` (${pendingCount} por subir, se suben solos al volver la señal)` : ''}
              </span>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-bold text-amber-700 hover:underline shrink-0"
            >
              Conectar Base de Datos
            </button>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2 shadow-sm">
            <p className="font-medium">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="text-red-500 hover:text-red-700 font-bold text-xs shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Dynamic Tab Body */}
        {loading && entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-300">
            <div className="relative">
              <Loader2 className="animate-spin text-amber-600" size={44} />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Cargando Bóveda Brasão
            </p>
          </div>
        ) : activeTab === 'count' ? (
          <InventoryForm 
            onAdd={addEntry} 
            onOCRResults={addEntries}
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

      {/* Supabase Connection Modal */}
      <SupabaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnectionSuccess={() => {
          loadData();
        }}
        entriesCount={entries.length}
      />

      {/* Navigation Dock (Mobile-First & iPad-Optimized) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:bottom-3 md:left-auto md:right-auto md:w-full md:flex md:justify-center pointer-events-none">
        <div className="pointer-events-auto bg-white/95 md:bg-[#0b0e14]/95 backdrop-blur-xl border-t border-slate-200 md:border md:border-amber-500/30 md:rounded-2xl md:shadow-2xl px-6 py-2.5 sm:py-3 flex justify-around items-center w-full md:w-auto md:min-w-[340px] md:gap-8">
          <button 
            onClick={() => setActiveTab('count')}
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 px-3 py-1 rounded-xl ${
              activeTab === 'count' 
                ? 'text-amber-600 md:text-amber-400 font-bold' 
                : 'text-slate-400 hover:text-slate-600 md:hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${
              activeTab === 'count' 
                ? 'bg-amber-100/70 md:bg-amber-500/20' 
                : 'bg-transparent'
            }`}>
              <ClipboardList size={20} strokeWidth={activeTab === 'count' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Conteo</span>
          </button>

          <button 
            onClick={() => setActiveTab('report')}
            className={`flex flex-col items-center gap-1 transition-all active:scale-95 px-3 py-1 rounded-xl ${
              activeTab === 'report' 
                ? 'text-amber-600 md:text-amber-400 font-bold' 
                : 'text-slate-400 hover:text-slate-600 md:hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${
              activeTab === 'report' 
                ? 'bg-amber-100/70 md:bg-amber-500/20' 
                : 'bg-transparent'
            }`}>
              <BarChart3 size={20} strokeWidth={activeTab === 'report' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Reportes</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
