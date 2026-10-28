
import React, { useState } from 'react';
import { GroupedReport, InventoryEntry, LocationType } from '../types';
import { Download, Trash2, XCircle, DollarSign, Package, MapPin, Wine as WineIcon, Beer, Edit2, Check, X } from 'lucide-react';

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

  const totalInventoryValue = report.reduce((sum, item) => sum + item.totalValue, 0);

  // Grouping logic for the visual separation
  const liquors = report.filter(item => item.category.startsWith('Liquor'));
  const wines = report.filter(item => !item.category.startsWith('Liquor'));

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
      alert("Please enter a valid quantity.");
      return;
    }
    if (!editItemName.trim()) {
      alert("Item name cannot be empty.");
      return;
    }
    onUpdateEntry(id, { qty, location: editLocation, itemName: editItemName.trim() });
    setEditingId(null);
  };

  const downloadCSV = () => {
    if (report.length === 0) return;
    
    const headers = ['Item Name', 'Category', 'Unit Price', 'Cellar Qty', 'Bar Qty', 'Total Qty', 'Total Value'];
    const rows = report.map(item => [
      item.name,
      item.category,
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
    link.setAttribute('download', `detailed_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCard = (item: GroupedReport, idx: number) => {
    const isLiquor = item.category.startsWith('Liquor');
    const unitLabel = isLiquor ? 'pour' : 'btl';

    return (
      <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-50">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">
                {item.category}
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-1 leading-tight">{item.name}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">Total Value</p>
              <p className="text-lg font-extrabold text-indigo-600">${item.totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50/50 p-4 grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">Price: </span>
              <span className="text-xs font-bold text-slate-700">${item.price.toFixed(2)} / {unitLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">Total Qty: </span>
              <span className="text-xs font-bold text-slate-700">{item.totalQty}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Cellar</span>
              <span className="font-bold text-slate-700">{item.cellarQty}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${(item.cellarQty / (item.totalQty || 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] pt-1">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Bar</span>
              <span className="font-bold text-slate-700">{item.barQty}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-500" 
                style={{ width: `${(item.barQty / (item.totalQty || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Summary Header Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Value</p>
          <p className="text-xl font-bold mt-1">${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Items</p>
          <p className="text-xl font-bold mt-1 text-slate-800">{report.length}</p>
        </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-bold text-slate-800">Inventory Cards</h2>
        <div className="flex gap-2">
          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg active:scale-95 transition-all font-semibold text-xs"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={onClear}
            className="p-2 bg-red-100 text-red-600 rounded-lg active:scale-95 transition-all"
            title="Clear All"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {report.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-400">No data found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* WINES SECTION */}
          {wines.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-indigo-500 pl-3">
                <WineIcon size={18} className="text-indigo-500" />
                <h3 className="text-md font-bold text-slate-700 uppercase tracking-wider">Wine Inventory</h3>
                <span className="text-xs font-medium text-slate-400">({wines.length})</span>
              </div>
              <div className="space-y-4">
                {wines.map((item, idx) => renderCard(item, idx))}
              </div>
            </div>
          )}

          {/* LIQUORS SECTION */}
          {liquors.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
                <Beer size={18} className="text-orange-500" />
                <h3 className="text-md font-bold text-slate-700 uppercase tracking-wider">Liquor Inventory</h3>
                <span className="text-xs font-medium text-slate-400">({liquors.length})</span>
              </div>
              <div className="space-y-4">
                {liquors.map((item, idx) => renderCard(item, idx))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Log / History */}
      <div className="mt-10 space-y-4">
        <div className="flex items-center gap-2 px-1">
          <MapPin size={16} className="text-slate-400" />
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Entry History</h3>
        </div>
        <div className="space-y-2">
          {rawEntries.slice(0, 8).map(entry => {
            const isEditing = editingId === entry.id;

            return (
              <div key={entry.id} className={`bg-white px-4 py-3 rounded-xl border ${isEditing ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-100'} flex justify-between items-center group transition-all shadow-sm`}>
                <div className="flex-1 min-w-0 pr-4">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editItemName}
                      onChange={(e) => setEditItemName(e.target.value)}
                      className="w-full font-semibold text-slate-800 text-sm bg-slate-50 border border-slate-200 rounded px-1 outline-none mb-1"
                    />
                  ) : (
                    <p className="font-semibold text-slate-800 leading-tight text-sm truncate">{entry.itemName}</p>
                  )}
                  
                  {isEditing ? (
                    <div className="mt-2 flex items-center gap-2">
                      <select 
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value as LocationType)}
                        className="text-[10px] font-bold uppercase p-1 bg-slate-50 border border-slate-200 rounded outline-none"
                      >
                        <option value={LocationType.CELLAR}>Cellar</option>
                        <option value={LocationType.BAR}>Bar</option>
                      </select>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2 text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                      <span className={entry.location === LocationType.CELLAR ? 'text-blue-500' : 'text-orange-600'}>{entry.location}</span>
                      <span>•</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">Count</p>
                    {isEditing ? (
                      <input 
                        type="number" 
                        step="0.25"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="w-16 font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 text-right outline-none"
                        autoFocus
                      />
                    ) : (
                      <p className="font-bold text-slate-700">{entry.qty}</p>
                    )}
                  </div>

                  <div className="flex gap-1 ml-2 border-l border-slate-100 pl-2">
                    {isEditing ? (
                      <>
                        <button 
                          onClick={() => saveEdit(entry.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={cancelEditing}
                          className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => startEditing(entry)}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => onRemoveEntry(entry.id)}
                          className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {rawEntries.length > 8 && (
            <div className="text-center py-4">
               <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Showing latest 8 of {rawEntries.length} entries</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryReport;
