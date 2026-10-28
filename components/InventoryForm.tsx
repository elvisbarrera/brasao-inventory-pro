
import React, { useState, useRef, useMemo } from 'react';
import { LocationType, InventoryEntry } from '../types.ts';
import { MASTER_WINE_LIST } from '../constants.tsx';
import { processHandwrittenSheet } from '../services/geminiService.ts';
import { Camera, Plus, Minus, Loader2, Search, X } from 'lucide-react';

interface Props {
  onAdd: (entry: Omit<InventoryEntry, 'id' | 'timestamp'>) => void;
  onOCRResults: (results: {name: string, qty: number}[]) => void;
}

const InventoryForm: React.FC<Props> = ({ onAdd, onOCRResults }) => {
  const [location, setLocation] = useState<LocationType>(LocationType.CELLAR);
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState<number | string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeList = useMemo(() => {
    if (location === LocationType.BAR) {
      return MASTER_WINE_LIST.filter(item => item.category.startsWith("Liquor"));
    } else {
      return MASTER_WINE_LIST.filter(item => !item.category.startsWith("Liquor"));
    }
  }, [location]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return activeList;
    return activeList.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  }, [activeList, searchTerm]);

  const handleAdd = () => {
    if (!itemName) {
      alert("Please select or enter an item name.");
      return;
    }
    const finalQty = typeof qty === 'string' ? parseFloat(qty) : qty;
    if (isNaN(finalQty)) {
      alert("Please enter a valid quantity.");
      return;
    }

    onAdd({
      itemName,
      location,
      qty: finalQty
    });

    setQty('');
    setSearchTerm('');
    setItemName('');
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
        alert(`Successfully scanned ${results.length} items.`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      alert("Failed to process handwritten sheet. Please check your API key.");
    }
  };

  const barButtons = [
    { label: 'Empty', val: 0 },
    { label: '0.25', val: 0.25 },
    { label: '0.5', val: 0.5 },
    { label: '0.75', val: 0.75 },
    { label: 'Full', val: 1.0 }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-indigo-900">Scan Handwriting</h3>
          <p className="text-xs text-indigo-700">Extract names & qty from photos</p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="bg-indigo-600 text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 relative">
        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => {
              setLocation(LocationType.CELLAR);
              setItemName('');
              setSearchTerm('');
              setQty('');
            }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${location === LocationType.CELLAR ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Cellar
          </button>
          <button
            onClick={() => {
              setLocation(LocationType.BAR);
              setItemName('');
              setSearchTerm('');
              setQty('');
            }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${location === LocationType.BAR ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Bar
          </button>
        </div>

        <div className="space-y-2 relative">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {location === LocationType.CELLAR ? 'Wine Selection' : 'Liquor Selection'}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder={location === LocationType.CELLAR ? "Search Wine List..." : "Search Liquors..."} 
              value={isDropdownOpen ? searchTerm : (itemName || searchTerm)}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setItemName(e.target.value);
                setIsDropdownOpen(true);
              }}
              className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            {(itemName || searchTerm) && (
              <button 
                onClick={() => { setItemName(''); setSearchTerm(''); }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
          
          {isDropdownOpen && (
            <div className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-[580px] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {location === LocationType.CELLAR ? `Full Wine List (${activeList.length})` : `Bar Liquors (${activeList.length})`}
                </span>
                <button 
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-indigo-600 text-xs font-bold"
                >
                  Done
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setItemName(item.name);
                        setSearchTerm('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 active:bg-indigo-100 border-b border-slate-50 last:border-none transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div className="pr-4">
                          <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{item.category}</p>
                        </div>
                        <p className="text-xs font-bold text-indigo-400 whitespace-nowrap">{item.price}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm italic">
                    No matching items found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</label>
          <div className="flex items-center gap-2">
            <button 
              onClick={decrementQty}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 active:bg-slate-200 transition-colors"
            >
              <Minus size={24} />
            </button>
            <input 
              type="number" 
              inputMode="decimal"
              step={location === LocationType.BAR ? "0.25" : "1"}
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="flex-1 min-w-0 px-2 py-4 text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center"
            />
            <button 
              onClick={incrementQty}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 active:bg-slate-200 transition-colors"
            >
              <Plus size={24} />
            </button>
          </div>

          {location === LocationType.BAR && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {barButtons.map(btn => {
                const numQty = Number(qty || 0);
                const isInteger = numQty % 1 === 0;
                let isActive = false;

                if (btn.label === 'Full') {
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
                        if (btn.label === 'Empty') {
                          return 0;
                        }
                        if (btn.label === 'Full') {
                          return Math.ceil(current) || 1;
                        }
                        return Math.floor(current) + btn.val;
                      });
                    }}
                    className={`py-3 rounded-lg text-[10px] font-bold transition-all border ${
                      isActive 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                      : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={handleAdd}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all hover:bg-indigo-700 mt-2"
        >
          <Plus size={24} />
          Add to Inventory
        </button>
      </div>

      <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center">
        <p className="text-xs text-slate-400 italic">
          {location === LocationType.CELLAR 
            ? "Cellar: +/- increments by 1.0." 
            : "Bar: +/- increments by 0.25. Quick-taps set the level of the CURRENT bottle."}
        </p>
      </div>
    </div>
  );
};

export default InventoryForm;
