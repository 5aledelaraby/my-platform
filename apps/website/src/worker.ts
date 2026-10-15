// The site Worker (ADR 0013). Static files are served by Cloudflare's asset handling; this code runs first only for
// the belts pages, the catalog feed and the sitemap (wrangler.toml `run_worker_first`). It asks the order API for the
// live stock and hides sold-out belts (lib/availability.ts, lib/feed.ts): a sold-out product page redirects to its
// design, and the belt leaves every list, the feed and the sitemap until it is restocked. Everything else passes through.
// If the API cannot be reached, pages are served as built: the cart and the API still refuse a sold-out product,
// so nothing can be ordered that is not in stock.
import { catalog } from "@platform/commerce";
import { designPath, hideSoldOut, isSoldOut, productFromPath, sitemapWithoutSoldOut, skipSoldOutSiblings } from "./lib/availability.ts";
import { FEED_PATH, feedWithStock } from "./lib/feed.ts";

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isFeed = url.pathname === FEED_PATH;
    const isSitemap = url.pathname === "/sitemap.xml";
    const isBelts = BELTS_PREFIX.test(url.pathname);
    if (request.method !== "GET" || !(isFeed || isSitemap || isBelts)) return env.ASSETS.fetch(request);

    const page = productFromPath(url.pathname);
    const [file, soldOut] = await Promise.all([freshAsset(request, env), soldOutIds(env, url)]);
    if (!soldOut || file.status !== 200) return file;

    if (page && soldOut.includes(page.product.id)) {
      return new Response(null, { status: 302, headers: { Location: designPath(page.product, page.en), "Cache-Control": "no-store" } });
    }
    if (isFeed) return rewritten(file, feedWithStock(await file.text(), (id) => soldOut.includes(id)));
    if (isSitemap) return rewritten(file, sitemapWithoutSoldOut(await file.text(), soldOut));
    if (!(file.headers.get("Content-Type") ?? "").includes("text/html")) return file;
    let html = hideSoldOut(await file.text(), soldOut);
    if (page) html = skipSoldOutSiblings(html, page.product, page.en, soldOut);
    return rewritten(file, html);
  },
};
