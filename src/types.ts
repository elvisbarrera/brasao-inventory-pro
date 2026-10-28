export enum LocationType {
  CELLAR = 'Cellar',
  BAR = 'Bar',
}

export interface InventoryEntry {
  id: string;
  timestamp: number;
  itemName: string;
  location: LocationType;
  qty: number;
}

/** What the UI provides when counting; id/timestamp are assigned on save. */
export type NewEntry = Omit<InventoryEntry, 'id' | 'timestamp'>;

export interface WineItem {
  id: string;
  name: string;
  category: string;
  /** Wine: per bottle. Spirits: per pour. Missing when the menu shows no price. */
  price?: string;
  /** No longer on the menu: hidden from counting, still resolves for old counts. */
  retired?: boolean;
  /** Previous names of this product (renumbered bin, fixed typo). */
  aka?: string[];
}

export interface ReportRow {
  name: string;
  category: string;
  isLiquor: boolean;
  unitPrice: number;
  cellarQty: number;
  barQty: number;
  totalQty: number;
  totalValue: number;
  lastCounted: number;
}
