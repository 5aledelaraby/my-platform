// On-model photos ("looks"): the belt worn with an outfit. Not every product has one yet, so the list is explicit;
// a test checks that every listed product exists and has both image sizes in public/img/looks/.
import type { CatalogProduct } from "@platform/commerce";

export const LOOK_IDS: ReadonlySet<string> = new Set([
  "pattern-black",
  "pattern-brown",
  "ruffle-red",
  "thin-tie-croc-pink",
  "thin-tie-green",
  "thin-tie-red",
  "thin-tie-rose",
  "thin-tie-royal-blue",
  "thin-tie-sky-blue",
  "wide-tie-burgundy",
  "wide-tie-green",
  "wide-tie-mustard",
]);

export const LOOK_SIZES = [640, 1200] as const;

/** The look photo of a product (4:5), or null when it has none. */
export function lookOf(p: CatalogProduct): { src: string; srcset: string } | null {
  if (!LOOK_IDS.has(p.id)) return null;
  const at = (w: number) => `/img/looks/${p.id}-${w}.webp`;
  return { src: at(640), srcset: LOOK_SIZES.map((w) => `${at(w)} ${w}w`).join(", ") };
}
