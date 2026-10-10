// Product availability on the pre-rendered product pages (ADR 0013).
// Pages are built with "in stock". The site Worker (src/worker.ts) reads the live stock from the order API on every
// product page request and, for a sold-out product, rewrites the page before it is sent: structured data says
// OutOfStock, the "sold out" message is shown and the add-to-cart button is disabled. So search engines, visitors
// without JavaScript and the cart script all see the same state, right after the owner changes the stock.
import { catalog } from "@platform/commerce";

const PRODUCT_IDS = new Set(catalog.products.map((p) => p.id));
const PRODUCT_PATH = /^\/(?:en\/)?collections\/vicuna-belts\/([a-z0-9-]+)\/?$/;

export const IN_STOCK = "https://schema.org/InStock";
export const OUT_OF_STOCK = "https://schema.org/OutOfStock";

/** The product id of a product page path, or null for any other page (style pages, the belts page, ...). */
export function productIdFromPath(pathname: string): string | null {
  const id = PRODUCT_PATH.exec(pathname)?.[1];
  return id && PRODUCT_IDS.has(id) ? id : null;
}

/**
 * Sold out = the product is tracked and its public stock is 0. Untracked products (no stock row) are always available,
 * the same rule the cart and the order API use.
 */
export function isSoldOut(stock: Readonly<Record<string, unknown>>, id: string): boolean {
  return stock[id] === 0;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Rewrites a built product page for a sold-out product. Idempotent; returns the html unchanged for other markup. */
export function markSoldOut(html: string, id: string): string {
  const q = escapeRe(id);
  return html
    .replaceAll(`"availability":"${IN_STOCK}"`, `"availability":"${OUT_OF_STOCK}"`)
    .replace(new RegExp(`(<[a-z]+\\b[^>]*\\bdata-soldout-for="${q}"[^>]*?)\\s+hidden(?=[\\s/>])`, "g"), "$1")
    .replace(new RegExp(`<button\\b(?![^>]*\\bdisabled\\b)([^>]*\\bdata-add="${q}")`, "g"), "<button disabled$1");
}

/** The availability the page's structured data states (for tests and checks). */
export function statedAvailability(html: string): string | null {
  return /"availability":"([^"]+)"/.exec(html)?.[1] ?? null;
}
