# ADR 0008: Order API (Cloudflare Worker + D1)

Status: accepted. Builds the "later" step of ADR 0007; supersedes only its phase-1 "no API" scope.

## Context
The owner decided to create orders through an API instead of making WhatsApp the order system. ADR 0007's separation stays: an order is created and stored first; what happens after (success page, WhatsApp, email, online payment) is a separate step decided by the website.

## Decision
- `apps/api`: a Cloudflare Worker using plain Web APIs (`Request`/`Response`), no framework. Routes: `GET /health`, `POST /orders` (+ CORS preflight). Served at `vicuna-eg.com/api/*`.
- All logic lives in `@platform/commerce` (validation, catalogue prices, totals, order building, order ids). The Worker only does HTTP, CORS and storage.
- **The server is the price authority.** Client prices are ignored; unit prices come from `catalog.json`, totals from the shared pricing functions. Orders store a snapshot (names, unit prices, totals) in piasters.
- Storage: Cloudflare D1, tables `orders` and `order_items` (migration `0001_orders.sql`). An `OrderRepository` interface has two implementations, D1 and in-memory (tests). That is the only abstraction added.
- Abuse controls: exact-origin allow-list, JSON-only, 16 KB body limit, honeypot field, input sanitising (control and bidi characters), quantity limits. IP rate limiting is a Cloudflare rule, not code.
- Privacy: customer data is stored only in D1; responses omit phone and address; logs contain an error name only.
- Order ids look like `V-MMDD-XXXXX` (same family as the legacy `V-MMDD-XXXX`, so GA4 purchases can still be matched to orders). Collisions are retried.
- No read endpoints. Orders are read from the Cloudflare dashboard until `apps/admin` exists behind authentication.

## Consequences
- The website cart must send `{ id, quantity }` lines plus customer fields, and handle the returned order (thank-you page, optional WhatsApp link). Money shown to customers is formatted from piasters.
- Payment stays cash on delivery or manual InstaPay; nothing is charged online.
- Shipping settings and the catalogue are code/data in `@platform/commerce`; changing a price means a commit and deploy of both website and API.
- The API runtime (wrangler, D1) could only be type-checked and unit-tested without the Cloudflare toolchain; the first deploy must be followed by a manual end-to-end test.
