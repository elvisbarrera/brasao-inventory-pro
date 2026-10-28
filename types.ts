
export enum LocationType {
  CELLAR = 'Cellar',
  BAR = 'Bar'
}

export interface InventoryEntry {
  id: string;
  timestamp: number;
  itemName: string;
  location: LocationType;
  qty: number;
}

export interface WineItem {
  id: string;
  name: string;
  category: string;
  price?: string;
}

export interface GroupedReport {
  name: string;
  category: string;
  price: number;
  cellarQty: number;
  barQty: number;
  totalQty: number;
  totalValue: number;
}
