# ADR 0009: The homepage is a brand introduction; the belts store lives under /belts/

Status: accepted. The product URL scheme `/belts/<product-id>/` was confirmed by the owner. Whether to keep the English twin under `/en/` is still open; the structure is already language-prefix ready.

## Context
The legacy homepage was the store: hero, product grid with filters, offer strip, styles, reviews and FAQ on one page. The platform is meant to grow into other areas (services, content, travel, media). A homepage that is the belts page cannot also introduce the brand or act as the entry point to those areas.

## Decision
- `/` is an introduction to Vicuna only: who we are, what we make, why trust us (delivery, returns, craft), a clear path into the store, and links to other areas as they launch. It does not contain the product grid, filters or the cart-building UI.
- The belts store is its own section:
  - `/belts/` all belts (filters, grid, multi-belt offer).
  - `/belts/<style>/` a style collection and ad landing page (lace, wide-bow, thin-tie, croc, snake, ruffle).
  - `/belts/<product-id>/` a product page. Product ids are permanent (ADR 0004); styles and products share one namespace under `/belts/`, so a build-time check must fail on any id that collides with a style slug.
- Every future area gets its own top-level section (`/services/`, `/blog/`, `/travel/` ...). The homepage links to a section when it launches and never embeds its content.
- Language: Arabic at the root; if English is kept (as on the legacy site) it lives under `/en/` with the same structure and hreflang alternates.
- The cart is global: the header cart and checkout drawer work on every page, and the cart persists across pages. The homepage may offer "add to cart" nowhere; it links into `/belts/`.

## SEO consequences
- Brand queries ("Vicuna", "فيكونا") land on `/`, which carries the Organization JSON-LD. Commercial queries ("حزام خصر", "حزام دانتيل") target `/belts/` and its style pages, which carry Product and BreadcrumbList data.
- Ads and Google Merchant Center point at `/belts/...` pages, never at `/`.
- Breadcrumbs everywhere: Home > Belts > Style/Product, independent of URL depth.
- `/` must not duplicate `/belts/` copy; the introduction links to the store with descriptive anchor text.

## Where legacy homepage sections go
- Stay on `/`: hero (brand version), perks (delivery, returns, payment), made-by-hand, bespoke service teaser (later `/services/`), lookbook teaser, general FAQ, short link blocks to the store, guides and policies. Reviews only if they are real and approved by the owner.
- Move to `/belts/`: shop with filters, offer strip, shop-by-style, how-to-tie steps, product-related FAQ.
