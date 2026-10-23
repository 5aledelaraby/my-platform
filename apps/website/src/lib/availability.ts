// Sold-out belts are hidden (owner, 2026-10-10; ADR 0013). Pages are pre-rendered with every belt. The site Worker
// (src/worker.ts) reads the live stock from the order API on every belts page, the catalog feed and the sitemap, and
// removes what is sold out before sending them: a sold-out product page redirects to its design, its cards and colour
// swatches disappear from every list, the arrows on a product photo skip it, and it leaves the feed and the sitemap.
// When the owner adds stock again, it comes back by itself. No rebuild is needed either way.
import { catalog } from "@platform/commerce";
import type { CatalogProduct } from "@platform/commerce";

const BY_ID = new Map(catalog.products.map((p) => [p.id, p]));
const PRODUCT_PATH = /^\/(ar\/)?collections\/vicuna-belts\/([a-z0-9-]+)\/?$/;
const BELTS = "/collections/vicuna-belts/";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The product of a product page path (and whether it is the Arabic page, under /ar/), or null for any other page. */
export function productFromPath(pathname: string): { product: CatalogProduct; ar: boolean } | null {
  const m = PRODUCT_PATH.exec(pathname);
  const product = m?.[2] ? BY_ID.get(m[2]) : undefined;
  return product ? { product, ar: Boolean(m?.[1]) } : null;
}

/** Kept for callers that only need the id. */
export const productIdFromPath = (pathname: string): string | null => productFromPath(pathname)?.product.id ?? null;

/**
 * Sold out = the product is tracked and its public stock is 0. Untracked products (no stock row) are always available,
 * the same rule the cart and the order API use.
 */
export function isSoldOut(stock: Readonly<Record<string, unknown>>, id: string): boolean {
  return stock[id] === 0;
}

/** Where a sold-out product page sends the visitor: its design's page, in the same language. */
export const designPath = (p: CatalogProduct, ar: boolean): string => `${ar ? "/ar" : ""}${BELTS}${p.style}/`;

/** Removes product cards and colour swatches of sold-out products from a built page. */
export function hideSoldOut(html: string, soldOut: readonly string[]): string {
  let out = html;
  for (const id of soldOut) {
    const q = escapeRe(id);
    out = out
      .replace(new RegExp(`<article class="card[^"]*"[^>]*\\bdata-product="${q}"[\\s\\S]*?</article>`, "g"), "")
      .replace(new RegExp(`<a class="swatch[^"]*" href="(?:/ar)?${escapeRe(BELTS)}${q}/"[^>]*></a>`, "g"), "");
  }
  return out;
}

/**
 * On a product page, points the photo arrows, the swipe targets and the "n / total" counter at the colours of the same
 * design that are in stock. With no other colour left, the arrows and the counter are removed.
 */
export function skipSoldOutSiblings(html: string, product: CatalogProduct, ar: boolean, soldOut: readonly string[]): string {
  const gone = new Set(soldOut);
  const siblings = catalog.products.filter((p) => p.style === product.style && (p.id === product.id || !gone.has(p.id)));
  const url = (p: CatalogProduct) => `${ar ? "/ar" : ""}${BELTS}${p.id}/`;
  let out = html.replace(/\s*<link rel="prefetch" href="[^"]*"\s*\/?>/g, "");
  if (siblings.length < 2) {
    return out
      .replace(/\s*<a class="pdp-arrow (?:prev|next)"[\s\S]*?<\/a>/g, "")
      .replace(/\s*<span class="pdp-count"[^>]*>[^<]*<\/span>/, "")
      .replace(/\s*data-swipe-(?:next|prev)="[^"]*"/g, "");
  }
  const i = siblings.findIndex((p) => p.id === product.id);
  const next = siblings[(i + 1) % siblings.length]!;
  const prev = siblings[(i - 1 + siblings.length) % siblings.length]!;
  out = out
    .replace(/data-swipe-next="[^"]*"/, `data-swipe-next="${url(next)}"`)
    .replace(/data-swipe-prev="[^"]*"/, `data-swipe-prev="${url(prev)}"`)
    .replace(/(<a class="pdp-arrow prev" href=")[^"]*"(?: aria-label="[^"]*")?/, `$1${url(prev)}" aria-label="${ar ? "اللون السابق" : "Previous colour"}"`)
    .replace(/(<a class="pdp-arrow next" href=")[^"]*"(?: aria-label="[^"]*")?/, `$1${url(next)}" aria-label="${ar ? "اللون التالي" : "Next colour"}"`)
    .replace(/(<span class="pdp-count"[^>]*>)[^<]*(<\/span>)/, `$1${i + 1} / ${siblings.length}$2`);
  return out;
}

/** Removes the sitemap entries of sold-out product pages (both languages: English at the root, Arabic under /ar/). */
export function sitemapWithoutSoldOut(xml: string, soldOut: readonly string[]): string {
  if (soldOut.length === 0) return xml;
  const ids = soldOut.map(escapeRe).join("|");
  return xml.replace(new RegExp(`\\n?\\s*<url><loc>[^<]*${escapeRe(BELTS)}(?:${ids})/</loc>(?:<lastmod>[^<]*</lastmod>)?</url>`, "g"), "");
}
