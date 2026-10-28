import { CATALOG } from './catalog.data';
import type { WineItem } from '@/types';

export { CATALOG };

/** Products currently on the menu: what can be counted and scanned. */
export const ACTIVE_CATALOG: WineItem[] = CATALOG.filter(item => !item.retired);

/** Liquor prices in the catalog are per pour; a bottle is ~25 pours. */
export const POURS_PER_BOTTLE = 25;

export const isLiquorCategory = (category: string) => category.startsWith('Liquor');

/** "Liquor - Bourbon/Whiskey" -> "Bourbon/Whiskey" */
export const shortCategory = (category: string) => category.replace(/^Liquor\s*-\s*/, '');

const key = (name: string) => name.trim().toLowerCase();

// Current names plus every previous name (`aka`), so counts saved under an old
// name (renumbered bin, fixed typo) keep resolving to the right product.
const byName = new Map<string, WineItem>();
for (const item of CATALOG) {
  byName.set(key(item.name), item);
  item.aka?.forEach(old => byName.set(key(old), item));
}

export const findCatalogItem = (name: string): WineItem | undefined => byName.get(key(name));

/** The product's current name for any current or previous name; unknown names pass through. */
export const canonicalName = (name: string): string => findCatalogItem(name)?.name ?? name;

export const priceNumber = (item?: WineItem): number =>
  item?.price ? parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0 : 0;

/** Value of one full bottle at menu price. */
export const bottleValue = (item?: WineItem): number =>
  priceNumber(item) * (item && isLiquorCategory(item.category) ? POURS_PER_BOTTLE : 1);
