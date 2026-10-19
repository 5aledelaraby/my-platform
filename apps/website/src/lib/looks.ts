// On-model photos ("looks"): the belt worn with an outfit. Not every product has one, so the list is explicit:
// product id -> how many photos it has. The first is /img/looks/<id>-<size>.webp (sizes 640, 800 and 1200), the next ones <id>-2-<size>.webp,
// <id>-3-<size>.webp... A test checks that every listed photo exists in both sizes and that no file is left unlisted.
import type { CatalogProduct } from "@platform/commerce";

export const LOOK_COUNTS: Readonly<Record<string, number>> = {
  "lace-white": 1,
  "pattern-black": 1,
  "pattern-brown": 3,
  "ruffle-brown": 1,
  "ruffle-red": 1,
  "thin-tie-camel": 1,
  "thin-tie-croc-pink": 1,
  "thin-tie-croc-wine": 1,
  "thin-tie-green": 1,
  "thin-tie-orange": 1,
  "thin-tie-red": 1,
  "thin-tie-rose": 1,
  "thin-tie-royal-blue": 1,
  "thin-tie-sky-blue": 1,
  "wide-tie-burgundy": 1,
  "wide-tie-green": 1,
  "wide-tie-mustard": 1,
};

export const LOOK_IDS: ReadonlySet<string> = new Set(Object.keys(LOOK_COUNTS));
export const LOOK_SIZES = [400, 640, 800, 1200] as const;

export interface Look { src: string; srcset: string }

/** The file name stem of a product's n-th look photo (n starts at 1). */
export const lookStem = (id: string, n: number): string => (n === 1 ? id : `${id}-${n}`);

/** Every look photo of a product (4:5), first one first. */
export function looksOf(p: CatalogProduct): Look[] {
  const count = LOOK_COUNTS[p.id] ?? 0;
  return Array.from({ length: count }, (_, i) => {
    const at = (w: number) => `/img/looks/${lookStem(p.id, i + 1)}-${w}.webp`;
    return { src: at(640), srcset: LOOK_SIZES.map((w) => `${at(w)} ${w}w`).join(", ") };
  });
}

/** The main look photo of a product, or null when it has none. */
export const lookOf = (p: CatalogProduct): Look | null => looksOf(p)[0] ?? null;
