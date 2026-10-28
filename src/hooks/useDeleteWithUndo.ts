import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { Inventory } from './useInventory';
import type { InventoryEntry } from '@/types';

export type DeleteEntries = (entries: InventoryEntry[], label: string) => void;

/** Deletes records right away and offers Undo, so a stray swipe never loses a count. */
export function useDeleteWithUndo(inventory: Pick<Inventory, 'removeMany' | 'restore'>): DeleteEntries {
  const notify = useToast();
  const { removeMany, restore } = inventory;

  return useCallback(
    (entries, label) => {
      if (entries.length === 0) return;
      removeMany(entries.map(e => e.id));
      const suffix = entries.length > 1 ? ` (${entries.length} records)` : '';
      notify(`Deleted ${label}${suffix}`, 'success', { label: 'Undo', onClick: () => restore(entries) });
    },
    [removeMany, restore, notify],
  );
}
