// The site Worker (ADR 0013). Static files are served by Cloudflare's asset handling; this code runs first only for
// the belts collection paths and the catalog feed (wrangler.toml `run_worker_first`). For a product page, or the feed,
// it asks the order API for the live stock and marks sold-out products (lib/availability.ts, lib/feed.ts).
// Everything else passes through.
// If the API cannot be reached, the page is served as built: the add button and the API still refuse a sold-out
// product, so nothing can be ordered that is not in stock.
import { isSoldOut, markSoldOut, productIdFromPath } from "./lib/availability.ts";
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

async function liveStock(env: Env, pageUrl: URL): Promise<Record<string, unknown> | null> {
  if (!env.API) return null;
  try {
    const res = await env.API.fetch(
      new Request(new URL("/api/stock", pageUrl), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(STOCK_TIMEOUT_MS) }),
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { stock?: unknown };
    return data.stock && typeof data.stock === "object" ? (data.stock as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The catalog feed with sold-out rows marked "out of stock", so Meta and Google stop advertising them. */
async function feed(request: Request, env: Env, url: URL): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  const [file, stock] = await Promise.all([env.ASSETS.fetch(new Request(request, { headers })), liveStock(env, url)]);
  if (file.status !== 200 || !stock) return file;
  const out = new Headers(file.headers);
  out.delete("ETag");
  out.delete("Content-Length");
  out.set("Cache-Control", "no-cache");
  return new Response(feedWithStock(await file.text(), (id) => isSoldOut(stock, id)), { status: 200, headers: out });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === FEED_PATH) return feed(request, env, url);
    const id = request.method === "GET" ? productIdFromPath(url.pathname) : null;
    if (!id) return env.ASSETS.fetch(request);

    // Never answer "not modified" for a product page: the stored copy may show an older stock state.
    const headers = new Headers(request.headers);
    headers.delete("If-None-Match");
    headers.delete("If-Modified-Since");
    const [page, stock] = await Promise.all([env.ASSETS.fetch(new Request(request, { headers })), liveStock(env, url)]);
    const type = page.headers.get("Content-Type") ?? "";
    if (page.status !== 200 || !type.includes("text/html")) return page;

    const out = new Headers(page.headers);
    out.delete("ETag");
    out.delete("Content-Length");
    out.set("Cache-Control", "no-cache");
    if (!stock || !isSoldOut(stock, id)) return new Response(page.body, { status: 200, headers: out });
    return new Response(markSoldOut(await page.text(), id), { status: 200, headers: out });
  },
};
