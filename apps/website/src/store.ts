// Website-side view of the catalog: URLs, English copy, display helpers. Prices and ids come from @platform/commerce.
import { catalog, formatEgp } from "@platform/commerce";
import type { CatalogProduct, CatalogStyle } from "@platform/commerce";
import { langPath } from "./site.ts";
import type { Lang } from "./site.ts";

const styleEn: Record<string, { name: string; headline: string; intro: string }> = {
  lace: {
    name: "Lace",
    headline: "A lace belt that turns the simplest dress into an evening set",
    intro: "Embroidered lace on an imported PU leather lining, tied with a thin ribbon. Right for outings and occasions, and it shapes the waist without pinching.",
  },
  "wide-bow": {
    name: "Wide Bow",
    headline: "A wide bow that draws the eye to your waist",
    intro: "Soft stretch PU leather that wraps the waist and moulds to it, tied in a big bow at the front or a knot with a long trailing end. The belt is the star of the outfit.",
  },
  "thin-tie": {
    name: "Thin Tie",
    headline: "The classic belt that goes with everything",
    intro: "A wide belt with a thin tie that wraps the waist and ties in a small bow. Soft stretch PU leather in many colours, for dresses, blouses and jackets.",
  },
  croc: {
    name: "Croc",
    headline: "A croc texture that gives any outfit character",
    intro: "Embossed croc pattern on imported PU leather, with a thin tie. A bold, rich touch for any plain outfit.",
  },
  snake: {
    name: "Snake",
    headline: "A modern snake print that stands out",
    intro: "Snake print on imported PU leather, with a thin tie. A different, modern touch for any plain outfit.",
  },
  ruffle: {
    name: "Ruffle",
    headline: "Ruffles that add movement and femininity",
    intro: "A belt with ruffles above and below and a tie in the middle. A soft, different touch for any plain dress.",
  },
};

const colorWordsEn: Record<string, string> = {
  black: "Black", white: "White", red: "Red", gold: "Gold", caramel: "Caramel", silver: "Silver", mustard: "Mustard",
  burgundy: "Burgundy", taupe: "Taupe", blush: "Blush", green: "Green", cognac: "Cognac", brown: "Brown", grey: "Grey",
  rose: "Rose", pink: "Pink", suede: "Suede", orange: "Orange", camel: "Camel", sky: "Sky", blue: "Blue", royal: "Royal",
  navy: "Navy", wine: "Wine", beige: "Beige",
};
const prefixEn: Record<string, string> = { sash: "Sash", twist: "Twist", classic: "Classic" };

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

const styleById = new Map(styles.map((s) => [s.id, s]));
const productById = new Map(products.map((p) => [p.id, p]));

// ADR 0009: styles and products share one namespace under /belts/.
for (const p of products) {
  if (styleById.has(p.id)) throw new Error(`Product id "${p.id}" collides with a style slug under /belts/`);
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
  const color = rest.map((w) => colorWordsEn[w] ?? w).join(" ");
  const pre = prefix ? (prefixEn[prefix] ?? "") : "";
  return [styleText("en", p.style).name, pre, color].filter(Boolean).join(" ");
}

export const price = (id: string): string => formatEgp(getStyle(id).price);
export const priceOfProduct = (p: CatalogProduct): string => price(p.style);
export const imageOf = (p: CatalogProduct): string => `/img/products/${p.id}.webp`;
export const thumbOf = (p: CatalogProduct): string => `/img/products/${p.id}-480.webp`;
/** First product of a style, used as its cover image. */
export const coverOf = (styleId: string): CatalogProduct => {
  const first = products.find((p) => p.style === styleId);
  if (!first) throw new Error(`Style ${styleId} has no products`);
  return first;
};
export const beltsUrl = (lang: Lang, slug?: string): string => langPath(lang, slug ? `/belts/${slug}/` : "/belts/");
