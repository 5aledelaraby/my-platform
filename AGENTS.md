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
packages/ui         design-system primitives (no domain knowledge)
content/            products and articles as files (source of truth for now)
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
- `ui` knows nothing about commerce, content or seo.
- Only `apps/*` may combine packages. Packages never import from apps.
- Import packages by name only (`@platform/commerce`), never by relative or deep path.
- Allowed dependencies live in `architecture/boundaries.json`. A new allowed dependency needs an edit there plus a short ADR, in the same PR.
- Add units with `node tools/architecture/new-unit.mjs <package|app> <name> [--may-import a,b]`, never by hand-copying folders. Recipes: `architecture/HOW-TO-ADD.md`. Where each future domain lives: `architecture/ROADMAP.md`.
- Do not create units "for the future". Create one only when it has a real consumer (see the three questions in ROADMAP.md).

## Site structure (ADR 0009)

- Two levels, as the owner asked (2026-10-10): `/` is a short brand introduction with cards for the brand's sections; `/collections/vicuna-belts/` is one full belts page (moving hero, style shortcuts, perks, every belt with the colour filter, how to tie, craft, FAQ). `/` never contains the product grid or cart-building UI.
- The store lives under `/collections/vicuna-belts/` (the page itself, `<style>/`, `<product-id>/`); the path is `BELTS_PATH` in `store.ts`. Articles live under `/journal/style-guides/` (`JOURNAL_PATH` in `site.ts`). No redirects from the old site (clean start). Other areas get their own top-level section and are only linked from `/`.
- Ads, Merchant Center and product keywords point to `/collections/vicuna-belts/...`, never to `/`.

## Commerce rules

- Money is **integer piasters** (`Piasters`). Never floats, never pounds in domain code. Convert at the edges with `egp()` / `formatEgp()`.
- Discount and totals logic exists **only** in `@platform/commerce`. The cart and the order API both call it. Never trust a price sent by the client: the API recomputes everything from the catalogue.
- WhatsApp is an optional channel, not the order system (ADR 0007). Cart, pricing and products never depend on it. The order API (`apps/api`, ADR 0008) exists, with inventory and an owner-only admin on its own hostname `admin.vicuna-eg.com` (ADR 0010; never serve admin on the store's hostname). Online payment is NOT built; do not build it, or abstractions for it, until the owner asks. Never expose order reads without authentication (orders contain customers' personal data): every admin route goes through the Access JWT check in `apps/api/src/access.ts`.
- Stock rules live in `@platform/commerce` (`inventory.ts`); the database enforces "never below zero". Staging has its own D1 database (`vicuna-db-staging`, binding `DB_STAGING`, chosen by `STAGING_HOST`), so test orders never touch live orders or stock; a staging request without it is refused, never sent to the live database. Apply every new migration to both databases. A new migration must be applied to D1 before the code that needs it is pushed.
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

## Policy pages

- `/shipping/`, `/returns/`, `/terms/` and `/privacy/` (and `/en/...`) are built from `apps/website/src/policies/`. Every fee, day count and percentage comes from `site.ts` or `@platform/commerce`; never type one into the text.
- The privacy page must describe what the site really does with personal data. Adding analytics, an ad pixel, or any new service that receives order or customer data requires updating `privacy.ts` and `cookies.ts` (and `site.policiesUpdated`) in the same change, before it goes live. Analytics and ad tags (GA4, Meta, TikTok, Snap; `tracking` in `site.ts`) load only after "Accept" in the cookie banner (`Consent.astro`, `scripts/tracking.ts`).
- Policies may give customers more than Egypt's Consumer Protection Law 181/2018 and Personal Data Protection Law 151/2020 require, never less.

## Brand and content rules (non-negotiable)

- Regular belts are **"جلد PU"**. Never write "جلد طبيعي" for them. Natural leather appears only for the bespoke/custom service.
- No third-party photos without rights. No invented reviews, ratings, sales counts or testimonials.
- Site language is Arabic (RTL) with Latin digits (0-9). English pages carry no Arabic text (except the company's registered Arabic name on the legal pages).
- Wording (owner, 2026-10-16): in Arabic always say "حزام وسط" or "حزام خصر" ("أحزمة الخصر" / "أحزمة الوسط"), never a bare "حزام" / "الأحزمة" in headings, buttons, menus and breadcrumbs; in English "waist belt".
- Palette and look (owner, 2026-10-10, updated 2026-10-16): white ground, near-black `#161616` type and buttons, thin lines, soft rounded corners (owner, 2026-10-16: no sharp square edges; `--r-sm/md/lg`), no shadows. Red (`--danger`) is for errors only; prices and accents are ink. Small gold twinkling stars (`ui/Sparkles.astro`) on the main headings and product photos, and every product photo sits on a soft glow of the belt's own colour (`.glow`, `--tint`). The signature-pattern page is dark with gold accents. The "Wear it with" pills on the product page are rounded and carry small emoji pictures (owner, 2026-10-16). Order (owner, 2026-10-16): the signature pattern design always comes first, then lace (the order of `styles` and `products` in `catalog.json`). Finish (owner, 2026-10-16): leaf green (`--leaf`) for the rings of the round photos and colour dots and a hairline round every belt tile; the header bag is the 🛍️ picture on a shining leaf-green circle; a small sun/moon button in the header switches light/dark; favourites are kept on the device only (`scripts/favorites.ts`, `vicuna-favorites`, page `/favorites/`, noindex, not in the sitemap). Photos first (owner, 2026-10-16): every design page opens on one large sideways photo slider (its film or an on-model photo; media per design in `lib/designs.ts`, page `DesignPage.astro`), then the title, then the belts; add new on-model photos to `lib/looks.ts` and they appear there. Photos below the first screen rise into view on scroll (`.media-rise`, set in `Base.astro`). Text font (owner, 2026-10-16): IBM Plex Sans Arabic, self-hosted in `public/fonts/` (El Messiri stays for headings). The menu is a floating navy panel of icon tiles over a blurred page, with a light/dark switch (dark mode: `:root[data-mode="dark"]`, choice kept in `vicuna-mode`, listed in the cookie policy) and a language switch. Logo (2026-10-10): navy `#152245` V-and-vicuña mark with a gold stripe, wordmark "VICUNA DESIGNS" (`ui/Logo.astro`, `public/brand/`). Editorial photos live in `public/img/editorial/`, product films in `public/video/` (muted, looping, with a poster).

## Security rules

- **Never ask for, accept, print, or commit tokens, passwords or API keys.** Secrets (Telegram, Cloudflare Access, the Meta Conversions API token `META_TOKEN`) live only as Cloudflare secrets. The order API sends the Purchase event to Meta (Conversions API, `apps/api/src/meta.ts`; owner-approved 2026-10-17) only for visitors who accepted cookies, with the phone hashed (SHA-256) and never the name or address; the privacy and cookie policies say so. Tracking IDs (GA4, Pixel ID) are public and may live in config.
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
