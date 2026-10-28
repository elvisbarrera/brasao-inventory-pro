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
  Loader2, 
  RefreshCcw, 
  Database,
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

      const testRes = await testSupabaseConnection();

      if (testRes.connected && testRes.tableExists) {
        const data = await supabaseService.fetchEntries();
        setEntries(data);
        storageService.saveEntries(data);
        setSupabaseStatus('connected');
        setLastSynced(new Date());
      } else if (testRes.connected && !testRes.tableExists) {
        setSupabaseStatus('missing_table');
        const localData = storageService.getEntries();
        setEntries(localData);
      } else {
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
      const localData = storageService.getEntries();
      setEntries(localData);
    } finally {
      setLoading(false);
    }
  }, []);

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
        setError("Guardado en local. Error en nube: " + err.message);
      } finally {
        setIsSyncing(false);
      }
    } else {
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
    if (window.confirm("¿Seguro que deseas eliminar todos los registros de inventario?")) {
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
                <span className="text-[12px] sm:text-[14px] font-bold tracking-wider text-amber-200/95 font-cinzel truncate">
                  INVENTORY PRO
                </span>
                <span className="hidden sm:inline-block text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
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
                {supabaseStatus === 'connected' ? 'Live' : supabaseStatus === 'missing_table' ? 'Setup DB' : 'Local'}
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
              <span>Modo almacenamiento local activo</span>
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
        {loading ? (
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
