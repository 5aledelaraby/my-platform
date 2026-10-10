// Website-side view of the catalog: URLs, English copy, display helpers. Prices and ids come from @platform/commerce.
import { catalog, formatEgp, priceOf } from "@platform/commerce";
import type { CatalogProduct, CatalogStyle } from "@platform/commerce";
import { langPath } from "./site.ts";
import type { Lang } from "./site.ts";

const styleEn: Record<string, { name: string; headline: string; intro: string }> = {
  lace: {
    name: "Lace",
    headline: "Lace PU leather belt",
    intro: "Embroidered lace on a PU leather lining, with a thin tie.",
  },
  "wide-tie": {
    name: "Wide Tie",
    headline: "Wide self-tie waist belt with wide ties",
    intro: "A wide, soft stretch PU leather belt with wide ties that wrap the waist. Tie it your way: a bow, a knot or a twist.",
  },
  "thin-tie": {
    name: "Thin Tie",
    headline: "Wide waist belt with an adjustable thin tie",
    intro: "A wide PU leather belt with a thin tie that adjusts to your waist. Plain, croc or snake print.",
  },
  ruffle: {
    name: "Ruffle",
    headline: "Ruffle PU leather belt",
    intro: "A belt with ruffles above and below and a tie in the middle.",
  },
};

// English product names come from the id (permanent, so some ids keep old words). Words mapped to "" are dropped.
const colorWordsEn: Record<string, string> = {
  black: "Black", white: "White", red: "Red", gold: "Gold", caramel: "Caramel", silver: "Silver", mustard: "Mustard",
  burgundy: "Burgundy", taupe: "Taupe", blush: "Blush", green: "Green", cognac: "Cognac", brown: "Brown", grey: "Grey",
  rose: "Rose", pink: "Pink", suede: "", orange: "Orange", camel: "Camel", sky: "Sky", blue: "Blue", royal: "Royal",
  navy: "Navy", wine: "Wine", beige: "Beige",
};
const prefixEn: Record<string, string> = { croc: "Croc", snake: "Snake" };

const colorEn: Record<string, string> = {
  black: "Black", white: "White", red: "Red", pink: "Pink", brown: "Brown", gold: "Gold & beige",
  yellow: "Yellow & orange", green: "Green", blue: "Blue", grey: "Grey & silver",
};
export const colors = catalog.colors;
export const colorName = (lang: Lang, id: string): string => {
  const c = catalog.colors.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown colour ${id}`);
  return lang === "ar" ? c.name : (colorEn[id] ?? c.name);
};

export const styles: readonly CatalogStyle[] = catalog.styles;
export const products: readonly CatalogProduct[] = catalog.products;

/** ADR 0009. Product ids are permanent; this path is not. */
export const BELTS_PATH = "/collections/vicuna-belts/";

const styleById = new Map(styles.map((s) => [s.id, s]));
const productById = new Map(products.map((p) => [p.id, p]));

// ADR 0009: styles and products share one namespace under the belts collection.
for (const p of products) {
  if (styleById.has(p.id)) throw new Error(`Product id "${p.id}" collides with a style slug under ${BELTS_PATH}`);
}

export function getStyle(id: string): CatalogStyle {
  const s = styleById.get(id);
  if (!s) throw new Error(`Unknown style ${id}`);
  return s;
}
export const getProduct = (id: string): CatalogProduct | undefined => productById.get(id);
export const productsOfStyle = (styleId: string): CatalogProduct[] => products.filter((p) => p.style === styleId);

export function styleText(lang: Lang, id: string): { name: string; headline: string; intro: string } {
  const s = getStyle(id);
  if (lang === "ar") return { name: s.name, headline: s.headline, intro: s.intro };
  const en = styleEn[id];
  if (!en) throw new Error(`Missing English copy for style ${id}`);
  return en;
}

export function productName(lang: Lang, p: CatalogProduct): string {
  if (lang === "ar") return p.name;
  const [prefix, ...rest] = p.id.split("-");
  const color = rest.map((w) => colorWordsEn[w] ?? w).filter(Boolean).join(" ");
  const pre = prefix ? (prefixEn[prefix] ?? "") : "";
  return [styleText("en", p.style).name, pre, color].filter(Boolean).join(" ");
}

/** The style's base price (the lowest in the style). */
/** The product name without its design ("كروكو أسود", "Croc Black"), for "Colour:" labels next to the design name. */
export function shadeName(lang: Lang, p: CatalogProduct): string {
  const full = productName(lang, p);
  const prefixes = lang === "ar" ? ["رباط عريض ", "رباط رفيع ", `${getStyle(p.style).name} `] : [`${styleText("en", p.style).name} `];
  const hit = prefixes.find((x) => full.startsWith(x));
  return hit ? full.slice(hit.length) : full;
}
export const price = (id: string): string => formatEgp(getStyle(id).price);
export const priceOfProduct = (p: CatalogProduct): string => formatEgp(priceOf(p));
/** True when some products of the style cost more than its base price (patterned belts). */
export const hasHigherPrices = (styleId: string): boolean => productsOfStyle(styleId).some((p) => priceOf(p) !== getStyle(styleId).price);
export const imageOf = (p: CatalogProduct): string => `/img/products/${p.id}.webp`;
export const thumbOf = (p: CatalogProduct): string => `/img/products/${p.id}-480.webp`;
/** Products that also have an on-body photo (public/img/looks/<id>-480|900.webp, 4:5). */
const LOOKS = new Set(["classic-royal-blue", "bow-burgundy", "bow-taupe", "classic-rose", "bow-gold", "classic-green", "sash-green", "croc-pink", "classic-pink-suede"]);
export const lookOf = (p: CatalogProduct): { thumb: string; full: string } | null =>
  LOOKS.has(p.id) ? { thumb: `/img/looks/${p.id}-480.webp`, full: `/img/looks/${p.id}-900.webp` } : null;
/** First product of a style, used as its cover image. */
export const coverOf = (styleId: string): CatalogProduct => {
  const first = products.find((p) => p.style === styleId);
  if (!first) throw new Error(`Style ${styleId} has no products`);
  return first;
};
/** The belts collection: one full page (story and every belt), with styles and products under it. */
export const beltsUrl = (lang: Lang, slug?: string): string => langPath(lang, slug ? `${BELTS_PATH}${slug}/` : BELTS_PATH);
