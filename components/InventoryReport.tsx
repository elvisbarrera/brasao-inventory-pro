import React, { useState } from 'react';
import { GroupedReport, InventoryEntry, LocationType } from '../types.ts';
import { Download, Trash2, XCircle, DollarSign, Package, Wine as WineIcon, Beer, Edit2, Check, X, Search, Clock } from 'lucide-react';

interface Props {
  report: GroupedReport[];
  rawEntries: InventoryEntry[];
  onClear: () => void;
  onRemoveEntry: (id: string) => void;
  onUpdateEntry: (id: string, updatedFields: Partial<InventoryEntry>) => void;
}

const InventoryReport: React.FC<Props> = ({ report, rawEntries, onClear, onRemoveEntry, onUpdateEntry }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  const [editItemName, setEditItemName] = useState<string>('');
  const [editLocation, setEditLocation] = useState<LocationType>(LocationType.CELLAR);
  const [searchTerm, setSearchTerm] = useState('');

  const totalInventoryValue = report.reduce((sum, item) => sum + item.totalValue, 0);
  const totalCellarUnits = report.reduce((sum, item) => sum + item.cellarQty, 0);
  const totalBarUnits = report.reduce((sum, item) => sum + item.barQty, 0);

  const filteredReport = report.filter(item => 
    !searchTerm || 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const liquors = filteredReport.filter(item => item.category.startsWith('Liquor'));
  const wines = filteredReport.filter(item => !item.category.startsWith('Liquor'));

  const startEditing = (entry: InventoryEntry) => {
    setEditingId(entry.id);
    setEditQty(entry.qty.toString());
    setEditItemName(entry.itemName);
    setEditLocation(entry.location);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    const qty = parseFloat(editQty);
    if (isNaN(qty)) {
      alert("Por favor ingresa una cantidad válida.");
      return;
    }
    if (!editItemName.trim()) {
      alert("El nombre no puede estar vacío.");
      return;
    }
    onUpdateEntry(id, { qty, location: editLocation, itemName: editItemName.trim() });
    setEditingId(null);
  };

  const downloadCSV = () => {
    if (report.length === 0) return;
    
    const headers = ['Item Name', 'Category', 'Unit Price', 'Cellar Qty', 'Bar Qty', 'Total Qty', 'Total Value'];
    const rows = report.map(item => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category.replace(/"/g, '""')}"`,
      item.price.toFixed(2),
      item.cellarQty.toString(),
      item.barQty.toString(),
      item.totalQty.toString(),
      item.totalValue.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `brasao_inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCard = (item: GroupedReport, idx: number) => {
    const isLiquor = item.category.startsWith('Liquor');
    const unitLabel = isLiquor ? 'pour (trago)' : 'botella';

    return (
      <div key={idx} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
        <div className="p-4 border-b border-slate-100">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block truncate">
                {item.category}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1 leading-tight line-clamp-2">
                {item.name}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Valor Total</p>
              <p className="text-base sm:text-lg font-extrabold text-amber-700">
                ${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50/60 p-4 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <DollarSign size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-400">Unit:</span>
              <span className="font-bold text-slate-800">${item.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Package size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-400">Total:</span>
              <span className="font-extrabold text-slate-900">{item.totalQty} {unitLabel}</span>
            </div>
          </div>

          <div className="space-y-1.5 justify-center flex flex-col">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Bodega</span>
              <span className="font-bold text-slate-800">{item.cellarQty}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-600 transition-all duration-500 rounded-full" 
                style={{ width: `${(item.cellarQty / (item.totalQty || 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] pt-0.5">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Barra</span>
              <span className="font-bold text-slate-800">{item.barQty}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-slate-700 transition-all duration-500 rounded-full" 
                style={{ width: `${(item.barQty / (item.totalQty || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Executive KPI Metric Cards (Responsive 4-Col on iPad, 2-Col on Mobile) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Valuation */}
        <div className="bg-[#0b0e14] text-white p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-md">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-300 font-cinzel">
            Valor Total
          </p>
          <p className="text-lg sm:text-2xl font-black mt-1 text-white tracking-tight">
            ${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Valuación estimada en inventario</p>
        </div>

        {/* KPI 2: Total Items */}
        <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Líneas de Producto
          </p>
          <p className="text-lg sm:text-2xl font-black mt-1 text-slate-900 tracking-tight">
            {report.length}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Vinos y licores registrados</p>
        </div>

        {/* KPI 3: Cellar Stock */}
        <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Stock Bodega (Cellar)
          </p>
          <p className="text-lg sm:text-2xl font-black mt-1 text-slate-900 tracking-tight">
            {totalCellarUnits.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Botellas cerradas en reserva</p>
        </div>

        {/* KPI 4: Bar Stock */}
        <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Stock Barra (Bar)
          </p>
          <p className="text-lg sm:text-2xl font-black mt-1 text-slate-900 tracking-tight">
            {totalBarUnits.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Botellas en servicio activo</p>
        </div>
      </div>

      {/* Action Bar & Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Filtrar por vino o licor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={downloadCSV}
            disabled={report.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0b0e14] text-amber-200 hover:text-white rounded-xl active:scale-95 transition-all font-bold text-xs shadow-xs border border-amber-500/20 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>
          
          <button 
            onClick={onClear}
            disabled={report.length === 0}
            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl active:scale-95 transition-all border border-red-200/50 disabled:opacity-50"
            title="Borrar todo el inventario"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Inventory Cards Section */}
      {report.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-2">
          <p className="text-slate-400 font-medium text-sm">No hay registros de inventario guardados todavía.</p>
          <p className="text-xs text-slate-400">Ve a la pestaña <strong>Conteo</strong> para registrar tus primeras botellas.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* WINES SECTION */}
          {wines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-l-4 border-amber-600 pl-3">
                <WineIcon size={18} className="text-amber-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider font-cinzel">
                  Inventario de Vinos & Champagne
                </h3>
                <span className="text-xs text-slate-400">({wines.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {wines.map((item, idx) => renderCard(item, idx))}
              </div>
            </div>
          )}

          {/* LIQUORS SECTION */}
          {liquors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-l-4 border-slate-800 pl-3">
                <Beer size={18} className="text-slate-800" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider font-cinzel">
                  Inventario de Licores & Destilados
                </h3>
                <span className="text-xs text-slate-400">({liquors.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {liquors.map((item, idx) => renderCard(item, idx))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Log / Entry History */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Clock size={16} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-cinzel">
            Historial de Registros Recientes
          </h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {rawEntries.slice(0, 10).map(entry => {
            const isEditing = editingId === entry.id;

            return (
              <div key={entry.id} className={`p-3.5 sm:p-4 flex justify-between items-center transition-colors ${
                isEditing ? 'bg-amber-50/60' : 'hover:bg-slate-50/60'
              }`}>
                <div className="flex-1 min-w-0 pr-3 sm:pr-4">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editItemName}
                      onChange={(e) => setEditItemName(e.target.value)}
                      className="w-full font-semibold text-slate-900 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none mb-1.5 focus:ring-2 focus:ring-amber-500"
                    />
                  ) : (
                    <p className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                      {entry.itemName}
                    </p>
                  )}
                  
                  {isEditing ? (
                    <div className="flex items-center gap-2 text-xs">
                      <select 
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value as LocationType)}
                        className="text-[10px] font-bold uppercase p-1 bg-white border border-slate-300 rounded outline-none"
                      >
                        <option value={LocationType.CELLAR}>Cellar</option>
                        <option value={LocationType.BAR}>Bar</option>
                      </select>
                      <span className="text-slate-300">·</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400 mt-1 uppercase font-semibold">
                      <span className={entry.location === LocationType.CELLAR ? 'text-amber-700' : 'text-slate-700'}>
                        {entry.location}
                      </span>
                      <span>·</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Cant.</p>
                    {isEditing ? (
                      <input 
                        type="number" 
                        step="0.25"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="w-16 font-bold text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 text-right outline-none text-xs sm:text-sm"
                        autoFocus
                      />
                    ) : (
                      <p className="font-extrabold text-slate-900 text-sm sm:text-base">{entry.qty}</p>
                    )}
                  </div>

                  <div className="flex gap-1 border-l border-slate-200 pl-2">
                    {isEditing ? (
                      <>
                        <button 
                          onClick={() => saveEdit(entry.id)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Guardar cambios"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={cancelEditing}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => startEditing(entry)}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                          title="Editar registro"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => onRemoveEntry(entry.id)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Eliminar de inventario"
                        >
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InventoryReport;
