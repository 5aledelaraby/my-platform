# ADR 0013: Live availability on product pages

Date: 2026-10-10. Status: proposed (waiting for the owner's review before deploy).

## Context

Product pages are pre-rendered (ADR 0002), and their Product structured data always said `InStock`. Stock lives in D1 and changes in the owner admin at any time (ADR 0010). A sold-out belt kept telling Google and Merchant Center it was available, while the page itself (after the cart script loaded the stock) said "sold out". Rebuilding the site on every stock change would need a deploy hook and still leaves a gap of minutes; the owner asked for a solution that stays correct without depending on a rebuild.

## Decision

- The site gets a small Worker (`apps/website/src/worker.ts`, `main` in `apps/website/wrangler.toml`). It runs first only for `/collections/vicuna-belts/*` and `/en/collections/vicuna-belts/*` (`run_worker_first`); every other path is served straight from the assets.
- For a product page it fetches the public stock from the order API over a service binding (`API` -> `vicuna-api`, `GET /api/stock`, the same capped data the cart uses) and, when the product is tracked at zero, rewrites the page before sending it: structured data `OutOfStock`, the sold-out message visible, the add button disabled. The rules are pure functions in `src/lib/availability.ts`, with tests.
- Untracked products (no stock row) are available, as everywhere else.
- Product pages are sent with `Cache-Control: no-cache` and without `ETag`, and conditional requests are not answered with 304, so a stored copy never shows an older state.
- If the API cannot be reached within 1.5 s, the page is served as built. Ordering stays safe: the cart and the API refuse sold-out items.

## Consequences

- Product page requests run a Worker and one internal API call (D1 read). Other pages are unchanged.
- Deploy order: `vicuna-api` must exist before `vicuna-site` is deployed with the service binding (it already does).
- The rewrite depends on the product page markup (`data-soldout-for`, `data-add`, the JSON-LD `availability` field); a test reads `ProductPage.astro` to catch a change.
