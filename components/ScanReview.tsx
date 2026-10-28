import React, { useState } from 'react';
import { Check, X, AlertTriangle, Wine, Beer, Camera } from 'lucide-react';
import { LocationType } from '../types.ts';
import { MASTER_WINE_LIST } from '../constants.tsx';
import { ScanItem, matchCatalog, locationFor } from '../services/scanService.ts';

interface Props {
  items: ScanItem[];
  onConfirm: (items: ScanItem[]) => void;
  onCancel: () => void;
}

const ScanReview: React.FC<Props> = ({ items: initial, onConfirm, onCancel }) => {
  const [items, setItems] = useState<ScanItem[]>(initial);

  const update = (key: string, patch: Partial<ScanItem>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));

  const onNameChange = (it: ScanItem, value: string) => {
    const match = matchCatalog(value);
    update(it.key, {
      itemName: value,
      matched: Boolean(match && match.name === value),
      location: match && match.name === value ? locationFor(match, it.location) : it.location,
    });
  };

  const selected = items.filter(i => i.selected && i.itemName.trim() && i.qty >= 0);
  const bottles = items.filter(i => i.kind === 'bottle').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-playfair font-bold text-lg text-slate-900 flex items-center gap-2">
              <Camera size={18} className="text-amber-600" /> Revisar escaneo
            </h2>
            <p className="text-[11px] text-slate-500">
              {items.length} detectados{bottles ? ` · ${bottles} por foto de botellas` : ''} · confirma antes de guardar
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <datalist id="catalog-names">
          {MASTER_WINE_LIST.map(i => <option key={i.id} value={i.name} />)}
        </datalist>

        <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No se reconoció ningún producto. Toma la foto más cerca y con buena luz.
            </div>
          )}
          {items.map(it => (
            <div key={it.key} className={`px-4 sm:px-5 py-3 flex gap-3 items-start ${it.selected ? '' : 'opacity-60'}`}>
              <input
                type="checkbox"
                checked={it.selected}
                onChange={e => update(it.key, { selected: e.target.checked })}
                className="mt-2.5 h-5 w-5 accent-amber-600 shrink-0"
                aria-label={`Incluir ${it.itemName}`}
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <input
                  list="catalog-names"
                  value={it.itemName}
                  onChange={e => onNameChange(it, e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold ${
                    it.matched ? 'border-slate-200 bg-slate-50' : 'border-amber-400 bg-amber-50'
                  }`}
                />
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {!it.matched && (
                    <span className="flex items-center gap-1 text-amber-800 font-bold">
                      <AlertTriangle size={11} /> No está en el catálogo, elige el correcto
                    </span>
                  )}
                  {it.rawName && it.rawName !== it.itemName && (
                    <span className="text-slate-400 truncate">Leído: “{it.rawName}”</span>
                  )}
                  {it.confidence > 0 && it.confidence < 0.6 && (
                    <span className="text-red-600 font-bold">Baja confianza</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex p-0.5 bg-slate-100 rounded-lg">
                    {[LocationType.CELLAR, LocationType.BAR].map(loc => (
                      <button
                        key={loc}
                        onClick={() => update(it.key, { location: loc })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                          it.location === loc ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {loc === LocationType.CELLAR ? <Wine size={12} /> : <Beer size={12} />}
                        {loc}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={it.location === LocationType.BAR ? 0.25 : 1}
                    min={0}
                    value={it.qty}
                    onChange={e => update(it.key, { qty: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-right"
                    aria-label="Cantidad"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Check size={16} /> Agregar {selected.length} al inventario
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanReview;
