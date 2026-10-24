# AGENTS.md: rules for any AI agent or developer working in this repo

The owner is Khaled Elaraby (Vicuna, women's waist belts, Egypt). **Always reply to the owner in Arabic.** Keep code, comments and commit messages in English.

## What this repo is

A modular-monolith monorepo (pnpm workspaces) for the Vicuna store: storefront, content/SEO, and later admin and workers. Not microservices. Read `architecture/adr/` before changing structure.

```
apps/website        storefront (Astro SSG; the cart is a small vanilla TypeScript script, no UI framework)
apps/api            order API: Cloudflare Worker + D1 (ADR 0008)
packages/commerce   money, pricing, discounts, cart totals (pure TS, no UI)
packages/seo        canonical, robots policy, sitemap, JSON-LD (pure TS)
packages/content    article/page content model and validation (pure TS)
content/articles    the journal guides, Arabic and English (Markdown, source of truth)
tools/architecture  boundary guard, secret scan, new-unit generator
architecture/       ADRs, boundaries.json, ROADMAP.md, HOW-TO-ADD.md
```

## Commands

```
pnpm install --frozen-lockfile   # install (pnpm only, never npm or yarn)
pnpm run check                   # secrets + boundaries + tests + typecheck + lint + production build (must pass before every commit)
pnpm test                        # node:test, no extra deps
pnpm check:boundaries            # architecture rules
```

`pnpm typecheck` and `pnpm build` run through Turborepo (`turbo.json`): packages in parallel, results cached in `.turbo/` (CI keeps that cache between runs). The build cache key includes `DEPLOY_ENV` and the root `content/` folder; add any new input outside a package to `globalDependencies`. `typecheck` depends on the `transit` node so a change in a workspace package invalidates the typecheck of every package that imports it; keep that link for any new task without outputs that reads other packages' source. Tests and lint stay plain root commands on purpose: they take seconds and always run in full.

## Architecture rules (enforced by `tools/architecture/check-boundaries.mjs` in CI)

- `commerce`, `seo`, `content` import no UI framework and no other internal package.
- Only `apps/*` may combine packages. Packages never import from apps.
- Import packages by name only (`@platform/commerce`), never by relative or deep path.
- Allowed dependencies live in `architecture/boundaries.json`. A new allowed dependency needs an edit there plus a short ADR, in the same PR.
- Add units with `node tools/architecture/new-unit.mjs <package|app> <name> [--may-import a,b]`, never by hand-copying folders. Recipes: `architecture/HOW-TO-ADD.md`. Where each future domain lives: `architecture/ROADMAP.md`.
- Do not create units "for the future". Create one only when it has a real consumer (see the three questions in ROADMAP.md).

## Site structure (ADR 0009, ADR 0015)

- Two levels (ADR 0015, owner 2026-10-19): `/` is light and simple, not a sales page: it opens on the owner's photo with the dress form and a belt (owner, 2026-10-23, so a visitor sees at once that we make belts; it opens the belts page), then on-model photos that each lead to the belt in them, one line about the brand, the designs as large words with their photos in a sideways row, and a link to all belts. No product grid, no "add to cart" on `/`. `/collections/vicuna-belts/` opens on the olive kimono on-model photo, then every belt; design pages use the same layout (`Collection.astro`).
- The store lives under `/collections/vicuna-belts/` (the page itself, `<style>/`, `<product-id>/`); the path is `BELTS_PATH` in `store.ts`. Articles live under `/journal/style-guides/` (`JOURNAL_PATH` in `site.ts`). No redirects from the old site (clean start). Other areas get their own top-level section and are only linked from `/`.
- Ads, Merchant Center and product keywords point to `/collections/vicuna-belts/...`, never to `/`.
- Journal (ADR 0016): guides in Arabic and English under `/journal/style-guides/`, real pages that are linked but not in the main menu: the footer, a "Style guides" row on the belts, design and product pages (`Guides.astro`), and the FAQ. Never hide text from visitors to show it to Google (cloaking breaks Google's spam policies). Every article sets `lang`; a pair in both languages is declared once with `translation:` and gets hreflang both ways. Articles name only current prices and fees and link only to belts that exist (`test/articles.test.ts`).
- No orphan pages: every indexable page must be linked from another page (`check-dist`).
- Arabic (ADR 0017): `/ar/` mirrors the store (home, belts, designs, products, cart, thank-you, favourites, About, Contact, FAQ). `langPath("ar", path)` adds the prefix; the policies and the journal are shared. The worker hides sold-out belts on `/ar/` too.

## Commerce rules

- Money is **integer piasters** (`Piasters`). Never floats, never pounds in domain code. Convert at the edges with `egp()` / `formatEgp()`.
- Discount and totals logic exists **only** in `@platform/commerce`. The cart and the order API both call it. Never trust a price sent by the client: the API recomputes everything from the catalogue.
- WhatsApp is an optional channel, not the order system (ADR 0007). Cart, pricing and products never depend on it. The order API (`apps/api`, ADR 0008) exists, with inventory and an owner-only admin on its own hostname `admin.vicuna-eg.com` (ADR 0010; never serve admin on the store's hostname). Online payment: PayPal only, in US dollars at the owner's fixed rate, paid on the thank-you page after the order is placed (owner, 2026-10-18, ADR 0014); its credentials live only in the vicuna-api dashboard (sandbox pair for staging, live pair for the live site). InstaPay is no longer offered (owner, 2026-10-18): new orders choose only `cod` or `paypal` (`OFFERED_PAYMENT_METHODS`); `instapay` stays readable for older orders. Do not add other payment providers until the owner asks. Never expose order reads without authentication (orders contain customers' personal data): every admin route goes through the Access JWT check in `apps/api/src/access.ts`.
- Stock rules live in `@platform/commerce` (`inventory.ts`); the database enforces "never below zero". The cart does not ask for the stock when a page loads (owner, 2026-10-18): the site Worker hides sold-out belts (ADR 0013), and the order API refuses a sold-out belt, its reply trimming the cart. Staging has its own D1 database (`vicuna-db-staging`, binding `DB_STAGING`, chosen by `STAGING_HOST`), so test orders never touch live orders or stock; a staging request without it is refused, never sent to the live database. Apply every new migration to both databases. A new migration must be applied to D1 before the code that needs it is pushed.
- Pickup (owner, 2026-10-17): shipping method `pickup` = the customer collects the order from Vicuna in Nasr City, free, with no governorate or address; the owner agrees the place (office or workshop) and time by phone, so no new address is published on the site. Stock is one count for the site and the store: sales made outside the site are entered by the owner in the admin. Stored as `shipping_method = 'standard'` with `pickup = 1` (migration 0005). The local inventory feed `/catalog/local-inventory.csv` (store code `STORE_CODE` in `lib/feed.ts`, which must match the Google Business Profile's store code, 01706577143159247027, assigned by Google) offers the same belts for pickup.
- Belts are sold at full price: the multi-belt offer was withdrawn (2026-10-09). The only discount is a promo code (ADR 0011): a fixed amount off the belts, one per order, created by the owner in the admin; rules in `@platform/commerce` (`promo.ts`), checked again by the API when the order is stored.
- Orders keep a snapshot of names, unit prices and totals (piasters) as of creation time. The catalogue lives in `packages/commerce/data/catalog.json`; product ids are permanent.
- Product `id` is permanent. A `slug` may change only together with a 301 redirect entry (ADR 0004).

## SEO rules

- Pages are pre-rendered HTML. Titles, canonicals, structured data and content must be in the HTML, not injected by client JS.
- Only the production deployment is indexable. Staging and previews use `robotsDirective()` => `noindex,nofollow`.
- Two site Workers (owner, 2026-10-17): `vicuna-site` serves staging.vicuna-eg.com from the `staging` branch (DEPLOY_ENV=staging); `vicuna-site-production` (`[env.production]` in `apps/website/wrangler.toml`) serves vicuna-eg.com from `main` (DEPLOY_ENV=production). Work goes to `pending`; "publish" moves it to `staging`; only "publish to the public" moves it to `main`. The API Worker (`vicuna-api`) is shared and deploys from `main`; it picks the database by hostname.
- Every website build must set `DEPLOY_ENV` (`production`, `staging` or `preview`). There is no default; a missing value fails the build. Never add one. (Only the local dev server falls back to `preview`, which is noindex.)
- JSON-LD only through `@platform/seo` and serialized with `serializeJsonLd()` (XSS-safe).
- **No `aggregateRating`, `review` or fake social proof, ever.** Only real, verifiable reviews, and only after the owner approves.

## Performance rules (owner, 2026-10-18: PageSpeed 100 on mobile and desktop)

- Animate only `opacity` and `transform` (or `translate`/`scale`), never `filter`, `background-position`, `left` or `stroke-dashoffset`: PageSpeed flags anything the compositor cannot run.
- The stylesheet is written into every page (`inlineStylesheets: "always"` in `astro.config.mjs`), so there is no render-blocking CSS request.
- After the build, `scripts/fingerprint.mjs` (`src/lib/fingerprint.ts`) rewrites every `/img/`, `/video/` and `/brand/` link in the pages to `/v/<hash>/<path>`, cached for a year (`public/_headers`); plain addresses keep the short cache. `check-dist` fails on a missing versioned file. Fonts are fingerprinted the same way (2026-10-20).
- Do not measure layout while a page loads (no `getBoundingClientRect`/`offsetWidth` in load-time scripts): use an IntersectionObserver or `requestAnimationFrame`.
- Product films (`FILM_IDS` in `lib/looks.ts`, `public/video/<id>.mp4` + `.webp` poster) are short, muted, about 540 px wide (~300 KB), and play only while on screen. Look photos have 400/640/800/1200 widths (`LOOK_SIZES` in `lib/looks.ts`), WebP about q74, 4:5; photos used in articles need the same copies (`-400/-640/-800` next to the `-1200`), and the photos in an article's text get them as a srcset and load lazily (`ProseImages.astro`, `lib/prose-images.ts`). The largest photo on a phone's first screen is never `loading="lazy"` (on the home page that is the dress-form photo). The stylesheet stays small (one file, `src/styles/global.css`, only the current look; phones first).

## Policy pages

- `/shipping/`, `/returns/`, `/terms/`, `/privacy/` and `/privacy/cookies/` are built from `apps/website/src/policies/`, in English only (owner, 2026-10-20: no Arabic on the policy pages); the terms are short, in the style of the store he showed, and still cover what Google Merchant Center and Meta check. Shipping and returns numbers must match the Merchant Center settings. Every fee, day count and percentage comes from `site.ts` or `@platform/commerce`; never type one into the text.
- The privacy page must describe what the site really does with personal data. Adding analytics, an ad pixel, or any new service that receives order or customer data requires updating `privacy.ts` and `cookies.ts` (and `site.policiesUpdated`) in the same change, before it goes live. Analytics and ad tags (GA4, Meta, TikTok, Snap; `tracking` in `site.ts`) load on every page of the live site from the first visit, on the visitor's first touch, scroll or key press (2026-10-20, PageSpeed 100: a page view made before it is held and sent then; a purchase loads them at once), and never on staging or previews (`data-track="off"` on `<html>`, set by `Base.astro` unless `DEPLOY_ENV=production`; owner, 2026-10-20): the owner removed the cookie banner (2026-10-19), knowing Egypt's Personal Data Protection Law executive regulations (Decree 816/2025) take effect around November 2026. A visitor can still turn them off from "Cookie settings" in the footer (`Consent.astro`, `scripts/tracking.ts`); a refusal is kept and respected on every page, including the server's Purchase event to Meta.
- Policies may give customers more than Egypt's Consumer Protection Law 181/2018 and Personal Data Protection Law 151/2020 require, never less.

## Brand and content rules (non-negotiable)

- Regular belts are **"جلد PU"**. Never write "جلد طبيعي" for them. Natural leather appears only for the bespoke/custom service.
- No third-party photos without rights. No invented reviews, ratings, sales counts or testimonials.
- Site language: English at the root since 2026-10-19 (see below), plus a full Arabic copy under `/ar/` since 2026-10-23 (owner; ADR 0017: right to left, hreflang both ways, language switch in the menu and footer; the policy pages stay English only). Every store page needs both languages (a page in `src/pages/` and in `src/pages/ar/`, and its path in `TRANSLATED` in `site.ts`); text added to a component needs its Arabic. English pages carry no Arabic text (except the company's registered Arabic name on the legal pages, the "العربية" language button, and the Arabic guides listed in their own right-to-left section of the journal; the last two are marked `lang="ar"`, and `check-dist` fails on any other Arabic on an English page).
- **English only, one look (owner, 2026-10-19; ADR 0015):** the site is English at the root (`langPath` returns the plain path); old `/en/...` addresses 301 to the root in `src/worker.ts`; the journal under `/journal/style-guides/` has guides in both languages (ADR 0016) and is not in the main menu. The look follows the layout and typeface of the store he showed (casasancho.com) and of the big fashion stores, with our own photos, logo and words, in calm colours on white (no navy, brown or rust): Poppins (self-hosted), a stone announcement bar `#F3F1EC`, a white header with the dark logo, ink `#111`, small-capital underlined links, black pill buttons, square "+" on cards, the owner's dark photo of a black bow belt behind the footer (words in white, light logo), no moving strip, generous white space (`--space`). A soft italic serif (Cormorant Garamond, `.script`) writes the few lines set on photos ("Transform your dress" on the lace white photo, "The art of the waist" on the About dress-form photo). The header is the white bar on every page (the transparent `Header overlay` / `Base overlayHeader` option stays available but the home page no longer uses it since 2026-10-23). A small "how to order" tip (`HowToBuy.astro`, `Base howto`) rises in after 6 seconds (owner, 2026-10-24) on the home, belts, design and product pages, once per visit, with three steps and a "Start shopping" button, and goes away with the ✕, that button, Escape or the first added belt; its storage key is in the cookie policy. The on-model photo comes first everywhere: cards show it (the belt alone on hover), product pages open on it with the belt photo after, and every photo links to the belt it shows. No dark mode, no neon, sparkles, glow or emoji. Phones first: most customers shop on a phone (owner, 2026-10-19), so every change is built and checked at phone width first. Home: the owner's collage photo (`public/img/founder-collage-*.webp`, also on About), one line, the lace white photo, the design rows. Belts page: the olive kimono photo (`pattern-brown` photo 2). The camel belt's photo is the cream shirt and beige trousers, to match the others. The lace white photo is the default link preview (og:image). Product "Material": "Imported PU leather. 100% guaranteed."
- Kept from the earlier looks: the signature pattern design always comes first, then lace (the order of `styles` and `products` in `catalog.json`). New on-model photos go into `lib/looks.ts` (and `public/img/looks/`) and appear on the cards, product pages and home rows. Favourites are kept on the device only (`scripts/favorites.ts`, `vicuna-favorites`, page `/favorites/`, noindex, not in the sitemap). Logo (2026-10-10): navy `#152245` V-and-vicuña mark with a gold stripe, wordmark "VICUNA DESIGNS" (`ui/Logo.astro`, `public/brand/`). Close-up photos live in `public/img/editorial/`.
- Wording (owner, 2026-10-16): in Arabic always say "حزام وسط" or "حزام خصر" ("أحزمة الخصر" / "أحزمة الوسط"), never a bare "حزام" / "الأحزمة" in headings, buttons, menus and breadcrumbs; in English "waist belt".

## Security rules

- **Never ask for, accept, print, or commit tokens, passwords or API keys.** Secrets (Telegram, Cloudflare Access, the Meta Conversions API token `META_TOKEN`) live only as Cloudflare secrets. The Meta Pixel runs in the site (`apps/website/src/scripts/tracking.ts`); the order API sends the Purchase event to Meta (Conversions API, `apps/api/src/meta.ts`; owner-approved 2026-10-17; this replaced the old site's separate `vicuna-capi` Worker, which the new site does not use) unless the visitor turned the tags off in "Cookie settings", with the phone hashed (SHA-256) and never the name or address; the privacy and cookie policies say so. Tracking IDs (GA4, Pixel ID) are public and may live in config.
- Scheduled jobs (`apps/api/src/scheduled.ts`, cron triggers in `apps/api/wrangler.toml`; owner-approved 2026-10-17): a daily JSON backup of the live database kept in the private R2 bucket `vicuna-backups` (binding `BACKUPS`) and sent to the owner's Telegram chat, and an hourly check of the site and `/api/health` that messages the owner when something fails, then at most once every 24 hours while it lasts (owner, 2026-10-17), and once when it is back.
- Orders and promo-code checks are rate-limited per visitor (Workers Rate Limiting: `ORDER_LIMIT` 5/min, `PROMO_LIMIT` 20/min in `apps/api/wrangler.toml`), because every order takes stock.
- `pnpm check:secrets` must pass. If a secret ever lands in git history, tell the owner to rotate it; deleting the commit is not enough.
- Never add `--no-verify`, never disable a CI check to get green.

## Definition of done

1. `pnpm run check` passes locally and in CI.
2. New domain logic has tests (pricing, SEO and content helpers are table-tested).
3. Structure changes have an ADR.
4. No new warnings, no TODOs without an owner-visible note in the PR description.
5. Summarize the change to the owner in Arabic, plainly, without jargon.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
