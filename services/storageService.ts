
import { InventoryEntry } from '../types.ts';

const STORAGE_KEY = 'wine_inventory_data';

export const storageService = {
  saveEntries: (entries: InventoryEntry[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },

  getEntries: (): InventoryEntry[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  clearAll: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
