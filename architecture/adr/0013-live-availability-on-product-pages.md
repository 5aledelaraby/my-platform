# ADR 0013: Sold-out belts are hidden, using the live stock

Date: 2026-10-10, updated 2026-10-16 and 2026-10-18. Status: accepted (owner).

## Context

Product pages, lists, the sitemap and the catalog feed (`/catalog/products.csv`, fetched by Meta and Google Merchant
Center) are pre-rendered (ADR 0002). Stock lives in D1 and changes in the owner admin at any time (ADR 0010). The owner
wants a belt set to zero to disappear from the store, and to come back by itself when restocked, without a rebuild.
On 2026-10-16 the 22 belts that were at zero were also removed from the catalogue for good.

## Decision

- The site has a small Worker (`apps/website/src/worker.ts`, `main` in `apps/website/wrangler.toml`). It runs first only
  for the belts pages, the catalog feed and the sitemap (`run_worker_first`); every other path is served straight from
  the assets.
- It reads the public stock from the order API over a service binding (`API` -> `vicuna-api`, `GET /api/stock`).
  Since 2026-10-18 the cart no longer asks for the stock when a page loads (owner): this Worker is the only reader. A belt tracked at zero is sold out: its product page redirects (302) to its design page, its
  cards and colour swatches are removed from every list, the photo arrows skip it, and it leaves the feed and the
  sitemap. Untracked belts (no stock row) are available, as everywhere else. The rules are pure functions in
  `src/lib/availability.ts` and `src/lib/feed.ts`, with tests.
- Rewritten responses are sent with `Cache-Control: no-cache` and without `ETag`, and conditional requests are not
  answered with 304, so a stored copy never shows an older state.
- If the API cannot be reached within 1.5 s, everything is served as built. Ordering stays safe: the API refuses sold-out
  items, and its reply trims the cart to what is left.

## Consequences

- Requests for those paths run a Worker and one internal API call (D1 read). Other pages are unchanged.
- Deploy order: `vicuna-api` must exist before `vicuna-site` is deployed with the service binding (it already does).
- The rewrites depend on the markup of `ProductCard.astro` and `ProductPage.astro`; a test reads both to catch a change.
