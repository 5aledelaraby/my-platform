// The site Worker (ADR 0013). Static files are served by Cloudflare's asset handling; this code runs first for the
// pages (wrangler.toml `run_worker_first`), the catalog feed and the sitemap. For the belts pages it asks the order API for the
// live stock and hides sold-out belts (lib/availability.ts, lib/feed.ts): a sold-out product page redirects to its
// design, and the belt leaves every list, the feed and the sitemap until it is restocked. Everything else passes through.
// If the API cannot be reached, pages are served as built: the cart and the API still refuse a sold-out product,
// so nothing can be ordered that is not in stock.
import { catalog } from "@platform/commerce";
import { designPath, hideSoldOut, isSoldOut, productFromPath, sitemapWithoutSoldOut, skipSoldOutSiblings } from "./lib/availability.ts";
import { FEED_PATH, LOCAL_FEED_PATH, feedWithStock } from "./lib/feed.ts";

/** The slice of a Workers service binding / assets binding this code uses. */
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  /** Static assets (wrangler.toml [assets] binding). */
  ASSETS: Fetcher;
  /** The order API Worker (wrangler.toml [[services]]), for GET /api/stock. */
  API?: Fetcher;
}

const STOCK_TIMEOUT_MS = 1500;
const BELTS_PREFIX = /^\/(?:en\/)?collections\/vicuna-belts\//;

/** Ids of the catalogue products that are sold out right now, or null when the stock is unknown. */
async function soldOutIds(env: Env, pageUrl: URL): Promise<string[] | null> {
  if (!env.API) return null;
  try {
    const res = await env.API.fetch(
      new Request(new URL("/api/stock", pageUrl), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(STOCK_TIMEOUT_MS) }),
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { stock?: unknown };
    if (!data.stock || typeof data.stock !== "object") return null;
    const stock = data.stock as Record<string, unknown>;
    return catalog.products.filter((p) => isSoldOut(stock, p.id)).map((p) => p.id);
  } catch {
    return null;
  }
}

/** The encodings this Worker compresses pages with, best first. */
const ENCODINGS = ["br", "gzip"] as const;

/**
 * A page leaves the Worker already compressed and marked `no-transform` (owner, 2026-10-17, trying it on staging):
 * Cloudflare then adds no script of its own to the page (its "JavaScript Detections" bot check, which cannot be
 * turned off from the dashboard on this plan and costs the phone ~1.5 s of work on a first visit). Because
 * `no-transform` also stops Cloudflare from compressing, the Worker compresses the page itself (Brotli or gzip,
 * as the browser accepts). Anything that is not an HTML page is returned untouched.
 */
export function untransformed(res: Response, request: Request): Response {
  if (!res.body || !(res.headers.get("Content-Type") ?? "").includes("text/html")) return res;
  const out = new Headers(res.headers);
  const cache = out.get("Cache-Control") ?? "public, max-age=0, must-revalidate";
  if (!/\bno-transform\b/.test(cache)) out.set("Cache-Control", `${cache}, no-transform`);
  const cf = (request as Request & { cf?: { clientAcceptEncoding?: string } }).cf;
  const accepted = (cf?.clientAcceptEncoding ?? request.headers.get("Accept-Encoding") ?? "").toLowerCase();
  const encoding = ENCODINGS.find((e) => new RegExp(`(^|[\\s,])${e}($|[\\s,;])`).test(accepted));
  out.delete("Content-Length");
  out.delete("Content-Encoding");
  if (encoding) out.set("Content-Encoding", encoding); // the Workers runtime compresses the body to match
  out.append("Vary", "Accept-Encoding");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/** The asset, never as "304 not modified": a stored copy may show an older stock state. */
function freshAsset(request: Request, env: Env): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  return env.ASSETS.fetch(new Request(request, { headers }));
}

function rewritten(res: Response, body: string): Response {
  const out = new Headers(res.headers);
  out.delete("ETag");
  out.delete("Content-Length");
  out.set("Cache-Control", "no-cache");
  return new Response(body, { status: res.status, headers: out });
}

/** The root address an old /en/ address now lives at (query kept), or null for any other address. */
export function englishRootRedirect(url: URL): string | null {
  if (url.pathname !== "/en" && !url.pathname.startsWith("/en/")) return null;
  return `${url.pathname.slice(3) || "/"}${url.search}`;
}

/** Addresses people type by habit that have no page of their own: "/collections" and "/collections/all" lead to the belts. */
const SHORTCUTS: Readonly<Record<string, string>> = { "/collections": "/collections/vicuna-belts/", "/collections/": "/collections/vicuna-belts/", "/collections/all": "/collections/vicuna-belts/", "/collections/all/": "/collections/vicuna-belts/" };
export function shortcutRedirect(url: URL): string | null {
  const to = SHORTCUTS[url.pathname];
  return to ? `${to}${url.search}` : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The site is English only at the root (owner, 2026-10-19): the old /en/ addresses move there for good.
    const enMove = englishRootRedirect(url) ?? shortcutRedirect(url);
    if (enMove) return new Response(null, { status: 301, headers: { Location: enMove, "Cache-Control": "public, max-age=86400" } });
    const isFeed = url.pathname === FEED_PATH || url.pathname === LOCAL_FEED_PATH;
    const isSitemap = url.pathname === "/sitemap.xml";
    const isBelts = BELTS_PREFIX.test(url.pathname);
    if (request.method !== "GET" || !(isFeed || isSitemap || isBelts)) return untransformed(await env.ASSETS.fetch(request), request);

    const page = productFromPath(url.pathname);
    const [file, soldOut] = await Promise.all([freshAsset(request, env), soldOutIds(env, url)]);
    if (!soldOut || file.status !== 200) return untransformed(file, request);

    if (page && soldOut.includes(page.product.id)) {
      return new Response(null, { status: 302, headers: { Location: designPath(page.product, page.en), "Cache-Control": "no-store" } });
    }
    if (isFeed) return rewritten(file, feedWithStock(await file.text(), (id) => soldOut.includes(id)));
    if (isSitemap) return rewritten(file, sitemapWithoutSoldOut(await file.text(), soldOut));
    if (!(file.headers.get("Content-Type") ?? "").includes("text/html")) return file;
    let html = hideSoldOut(await file.text(), soldOut);
    if (page) html = skipSoldOutSiblings(html, page.product, page.en, soldOut);
    return untransformed(rewritten(file, html), request);
  },
};
