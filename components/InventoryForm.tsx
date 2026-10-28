import React, { useState, useRef, useMemo } from 'react';
import { LocationType, InventoryEntry } from '../types.ts';
import { MASTER_WINE_LIST } from '../constants.tsx';
import { processHandwrittenSheet } from '../services/geminiService.ts';
import { Camera, Plus, Minus, Loader2, Search, X, Wine, Beer, Check, Sparkles } from 'lucide-react';

interface Props {
  onAdd: (entry: Omit<InventoryEntry, 'id' | 'timestamp'>) => void;
  onOCRResults: (results: { name: string; qty: number }[]) => void;
}

const InventoryForm: React.FC<Props> = ({ onAdd, onOCRResults }) => {
  const [location, setLocation] = useState<LocationType>(LocationType.CELLAR);
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState<number | string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [addedToast, setAddedToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeList = useMemo(() => {
    if (location === LocationType.BAR) {
      return MASTER_WINE_LIST.filter(item => item.category.startsWith("Liquor"));
    } else {
      return MASTER_WINE_LIST.filter(item => !item.category.startsWith("Liquor"));
    }
  }, [location]);

  // Extract unique categories for quick tabs
  const categories = useMemo(() => {
    const set = new Set<string>();
    activeList.forEach(item => set.add(item.category));
    return ['All', ...Array.from(set)];
  }, [activeList]);

  const filteredItems = useMemo(() => {
    let list = activeList;
    if (selectedCategory !== 'All') {
      list = list.filter(item => item.category === selectedCategory);
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return list;
    return list.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  }, [activeList, searchTerm, selectedCategory]);

  const selectedItemMeta = useMemo(() => {
    if (!itemName) return null;
    return MASTER_WINE_LIST.find(i => i.name.toLowerCase() === itemName.toLowerCase()) || null;
  }, [itemName]);

  const handleAdd = () => {
    if (!itemName) {
      alert("Por favor selecciona o escribe el nombre del producto.");
      return;
    }
    const finalQty = typeof qty === 'string' ? parseFloat(qty) : qty;
    if (isNaN(finalQty) || finalQty < 0) {
      alert("Por favor ingresa una cantidad válida.");
      return;
    }

    onAdd({
      itemName,
      location,
      qty: finalQty
    });

    const addedName = itemName;
    setAddedToast(`+${finalQty} ${addedName}`);
    setTimeout(() => setAddedToast(null), 2500);

    setQty('');
    setItemName('');
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const incrementQty = () => {
    setQty(prev => {
      const current = typeof prev === 'string' ? parseFloat(prev) || 0 : prev || 0;
      const step = location === LocationType.BAR ? 0.25 : 1;
      return Math.round((current + step) * 100) / 100;
    });
  };

  const decrementQty = () => {
    setQty(prev => {
      const current = typeof prev === 'string' ? parseFloat(prev) || 0 : prev || 0;
      const step = location === LocationType.BAR ? 0.25 : 1;
      return Math.max(0, Math.round((current - step) * 100) / 100);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const results = await processHandwrittenSheet(base64);
        onOCRResults(results);
        setIsProcessing(false);
        alert(`Se escanearon exitosamente ${results.length} productos manuscritos.`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      alert("Error al procesar la imagen manuscrita. Verifica tu conexión.");
    }
  };

  const barButtons = [
    { label: 'Empty', val: 0 },
    { label: '0.25', val: 0.25 },
    { label: '0.50', val: 0.5 },
    { label: '0.75', val: 0.75 },
    { label: 'Full (1.0)', val: 1.0 }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#0b0e14] text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <Check size={14} className="text-emerald-400" />
          <span>Registrado: {addedToast}</span>
        </div>
      )}

      {/* OCR Handwriting Scan Card */}
      <div className="bg-gradient-to-r from-[#0b0e14] via-[#141a24] to-[#0b0e14] text-white rounded-2xl p-3.5 sm:p-4 border border-amber-500/25 shadow-md flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Sparkles size={14} />
            <h3 className="font-bold text-xs sm:text-sm font-cinzel tracking-wider uppercase">
              Escaneo OCR con IA
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 truncate">
            Captura fotos de hojas manuscritas para autocompletar botellas
          </p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white p-2.5 sm:p-3 rounded-xl shadow-lg active:scale-95 transition-all shrink-0 disabled:opacity-50"
          title="Tomar foto de hoja manuscrita"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          capture="environment"
          onChange={handleFileChange}
        />
      </div>

      {/* Main Responsive Grid Layout (iPad 2-Column, Mobile Stacked) */}
      <div className="md:grid md:grid-cols-12 md:gap-6 space-y-4 md:space-y-0">
        
        {/* Left Column: Location & Selection (md:col-span-7) */}
        <div className="md:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-4">
            {/* Location Switcher */}
            <div className="flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/50">
              <button
                onClick={() => {
                  setLocation(LocationType.CELLAR);
                  setItemName('');
                  setSearchTerm('');
                  setSelectedCategory('All');
                  setQty('');
                }}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  location === LocationType.CELLAR 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Wine size={16} className={location === LocationType.CELLAR ? 'text-amber-600' : 'text-slate-400'} />
                <span>Cellar (Vinos & Champagne)</span>
              </button>

              <button
                onClick={() => {
                  setLocation(LocationType.BAR);
                  setItemName('');
                  setSearchTerm('');
                  setSelectedCategory('All');
                  setQty('');
                }}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  location === LocationType.BAR 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Beer size={16} className={location === LocationType.BAR ? 'text-amber-600' : 'text-slate-400'} />
                <span>Bar (Licores & Destilados)</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>{location === LocationType.CELLAR ? 'Catálogo de Vinos' : 'Catálogo de Licores'}</span>
                <span className="text-[10px] text-slate-400 lowercase font-medium">({filteredItems.length} opciones)</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder={location === LocationType.CELLAR ? "Buscar vino por nombre, bodega o categoría..." : "Buscar licor por nombre o tipo..."} 
                  value={isDropdownOpen ? searchTerm : (itemName || searchTerm)}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setItemName(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm font-medium"
                />
                {(itemName || searchTerm) && (
                  <button 
                    onClick={() => { setItemName(''); setSearchTerm(''); }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Category Quick Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {categories.slice(0, 8).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? 'bg-[#0b0e14] text-amber-300 border-amber-500/40 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Wine Selection List (Dropdown on Mobile, Integrated List on iPad) */}
            <div className={`border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs ${
              isDropdownOpen ? 'block max-h-72 md:max-h-96 overflow-y-auto' : 'hidden md:block md:max-h-80 md:overflow-y-auto'
            }`}>
              <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center text-[11px]">
                <span className="font-bold text-slate-500 uppercase tracking-wider">
                  Listado disponible ({filteredItems.length})
                </span>
                {isDropdownOpen && (
                  <button 
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-amber-700 font-bold hover:underline"
                  >
                    Listo
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => {
                    const isSelected = itemName.toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setItemName(item.name);
                          setSearchTerm('');
                          setIsDropdownOpen(false);
                          if (!qty) {
                            setQty(location === LocationType.CELLAR ? 1 : 1.0);
                          }
                        }}
                        className={`w-full text-left px-3.5 py-2.5 sm:py-3 transition-colors flex justify-between items-center ${
                          isSelected ? 'bg-amber-50/70 border-l-4 border-amber-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="pr-3 min-w-0">
                          <p className={`text-xs sm:text-sm font-semibold truncate ${isSelected ? 'text-amber-950 font-bold' : 'text-slate-800'}`}>
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                            {item.category}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-amber-700 bg-amber-50/60 px-2 py-0.5 rounded border border-amber-200/50">
                            {item.price}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No se encontraron productos coincidentes
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quantity Dials & Actions (md:col-span-5) */}
        <div className="md:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-4">
            {/* Selected Item Summary Card */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              itemName 
                ? 'bg-[#0b0e14] text-white border-amber-500/30 shadow-md' 
                : 'bg-slate-50 border-dashed border-slate-200 text-slate-400'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1">
                Producto Seleccionado
              </div>
              {itemName ? (
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-amber-100 leading-snug line-clamp-2">
                    {itemName}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-300">
                    <span>{location === LocationType.CELLAR ? 'Bodega' : 'Bar'}</span>
                    <span>·</span>
                    <span>{selectedItemMeta?.price || '$0.00'}</span>
                    <span>·</span>
                    <span className="text-amber-300">{selectedItemMeta?.category || 'General'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic py-1">
                  Selecciona un vino o licor de la lista para registrar...
                </p>
              )}
            </div>

            {/* Quantity Input with Ergonomic Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Cantidad a Registrar
              </label>

              <div className="flex items-center gap-2">
                <button 
                  onClick={decrementQty}
                  className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 active:scale-95 transition-all shrink-0 shadow-xs"
                >
                  <Minus size={22} />
                </button>

                <input 
                  type="number" 
                  inputMode="decimal"
                  step={location === LocationType.BAR ? "0.25" : "1"}
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="flex-1 min-w-0 h-12 sm:h-14 text-2xl sm:text-3xl font-extrabold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-center text-slate-800"
                />

                <button 
                  onClick={incrementQty}
                  className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 active:scale-95 transition-all shrink-0 shadow-xs"
                >
                  <Plus size={22} />
                </button>
              </div>

              {/* Bar Level Quick Taps */}
              {location === LocationType.BAR && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Nivel de Botella en Barra:
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {barButtons.map(btn => {
                      const numQty = Number(qty || 0);
                      const isInteger = numQty % 1 === 0;
                      let isActive = false;

                      if (btn.label.startsWith('Full')) {
                        isActive = isInteger && numQty > 0;
                      } else if (btn.label === 'Empty') {
                        isActive = isInteger && numQty === 0;
                      } else {
                        isActive = (numQty % 1) === btn.val;
                      }

                      return (
                        <button
                          key={btn.label}
                          onClick={() => {
                            setQty(prev => {
                              const current = typeof prev === 'string' ? parseFloat(prev) || 0 : prev || 0;
                              if (btn.label === 'Empty') return 0;
                              if (btn.label.startsWith('Full')) return Math.ceil(current) || 1;
                              return Math.floor(current) + btn.val;
                            });
                          }}
                          className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${
                            isActive 
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Primary Add Button */}
            <button
              onClick={handleAdd}
              disabled={!itemName}
              className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all ${
                itemName 
                  ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white hover:from-amber-700 hover:to-amber-900 shadow-amber-900/20' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus size={20} />
              <span>Añadir a Inventario</span>
            </button>
          </div>

          {/* Quick Helper Note */}
          <div className="p-3 bg-white/70 border border-slate-200/60 rounded-xl text-center text-[11px] text-slate-500">
            {location === LocationType.CELLAR 
              ? "Cellar: +/- incrementa de 1 en 1 botella entera." 
              : "Bar: +/- incrementa en cuartos (0.25). Los botones rápidos asignan el nivel actual."}
          </div>
        </div>

      </div>
    </div>
  );
};

export default InventoryForm;
