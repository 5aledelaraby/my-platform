# ADR 0010: Inventory and an owner-only admin inside the order API

Status: accepted (owner request, 2026-10-09). Amends ADR 0008 ("no read endpoints") and the ROADMAP rows for inventory and the admin dashboard.

## Context
The owner wants to track stock per product, show "sold out" on the store, stop selling what is not on hand, and manage orders (confirm, ship, deliver, cancel) from his phone. Choices he made: sold-out products stay visible but cannot be added; stock is taken when the order is stored; stock and orders are managed from a private admin page.

## Decision
- **Rules in `@platform/commerce`** (`inventory.ts`): order statuses and allowed transitions (`new → confirmed → shipped → delivered`, cancel allowed until delivered; delivered and cancelled are final), stock shortages, the capped public view of stock, and stock-aware `remainingQuantity` for the cart.
- **Storage in D1** (`migrations/0002_inventory.sql`): table `inventory` (one row per *tracked* product; no row = untracked and always available) with a named `CHECK (quantity >= 0)`. The order batch inserts the order, its items and one `UPDATE inventory` per item in one transaction, so an order that would push any product below zero fails as a whole (`409 out_of_stock`). `order_items.stock_taken` records which lines took stock; cancelling returns exactly those units. `orders.version` is an optimistic lock and `orders.change_id` ties the stock return to the one request that really cancelled, so a second or stale cancel returns nothing.
- **Public stock**: `GET /api/stock` returns tracked products only, capped at 20 per product (no real quantities disclosed), cacheable for 30 s. The store marks sold-out products and the cart caps quantities; the API stays the authority.
- **Admin v1 lives in `apps/api`** (HTML, JS and JSON from the same Worker), not in a separate `apps/admin`. One Worker and one Cloudflare project keep the owner's setup small. Split it out when the admin grows (product and content editing, media).
- **The admin has its own hostname, `admin.vicuna-eg.com`** (`ADMIN_HOST`), and is not served on the store's hostname at all. The Access session cookie is host-scoped, so a script on a store page (an XSS, or a third-party tag such as an ad pixel) cannot call the admin with the owner's session. The API Worker is reachable only through its routes (`workers_dev = false`).
- **Stock edits are compare-and-set**: the page sends the value it showed; if an order changed it meanwhile nothing is saved and the current value comes back (`409 stale`). The page also shows units held by open (new/confirmed) orders, because the owner counts the shelf, and the shelf still holds those units.
- **`/api/health` checks the schema** and answers 503 until the migrations this code needs are applied.
- **Authentication: Cloudflare Access (Zero Trust)** in front of the admin host, and the Worker verifies the Access JWT itself (signature against the team's public keys, issuer, audience, expiry, and an email allow-list), so the admin stays closed even if a request reaches the Worker without passing through Access. Settings `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` are dashboard secrets; without them admin answers 503.
- **Browser safety**: admin mutations need a custom header and a same-origin request (CSRF), the page has a strict CSP (`script-src 'self'`, `frame-ancestors 'none'`), and customer text is only ever inserted with `textContent`.

## Consequences
- Migration 0002 must be applied to D1 before the code that uses it is deployed (pushing to `main` deploys immediately).
- The product JSON-LD still says `InStock` (pages are static); a sold-out product's structured data can disagree with the page for as long as it is sold out. Revisit with a rebuild hook if Google flags it.
- Stock shown on the store can be up to 30 s old; the order API never sells beyond stock.
- Anonymous cash-on-delivery orders take stock immediately, so fake orders can hold stock until the owner cancels them. A Cloudflare rate-limiting rule on `POST /api/orders` is required before production; Turnstile or a per-phone cap are the next steps if abuse appears.
- Cancelling a shipped order always returns its stock (refused or returned parcel). A "cancel without restocking" choice (lost parcel) is not built.
- `packages/auth` from the ROADMAP is not created; the Access verifier is ~100 lines in `apps/api/src/access.ts` and moves out when a second app needs it.
