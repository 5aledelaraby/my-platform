# AGENTS.md: rules for any AI agent or developer working in this repo

The owner is Khaled Elaraby (Vicuna, women's waist belts, Egypt). **Always reply to the owner in Arabic.** Keep code, comments and commit messages in English.

## What this repo is

A modular-monolith monorepo (pnpm workspaces) for the Vicuna store: storefront, content/SEO, and later admin and workers. Not microservices. Read `architecture/adr/` before changing structure.

```
apps/website        storefront (Astro SSG + React islands for the cart)
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
pnpm check                       # secrets + boundaries + tests + typecheck + lint + build (must pass before every commit)
pnpm test                        # node:test, no extra deps
pnpm check:boundaries            # architecture rules
```

## Architecture rules (enforced by `tools/architecture/check-boundaries.mjs` in CI)

- `commerce`, `seo`, `content` import no UI framework and no other internal package.
- `ui` knows nothing about commerce, content or seo.
- Only `apps/*` may combine packages. Packages never import from apps.
- Import packages by name only (`@platform/commerce`), never by relative or deep path.
- Allowed dependencies live in `architecture/boundaries.json`. A new allowed dependency needs an edit there plus a short ADR, in the same PR.
- Add units with `node tools/architecture/new-unit.mjs <package|app> <name> [--may-import a,b]`, never by hand-copying folders. Recipes: `architecture/HOW-TO-ADD.md`. Where each future domain lives: `architecture/ROADMAP.md`.
- Do not create units "for the future". Create one only when it has a real consumer (see the three questions in ROADMAP.md).

## Commerce rules

- Money is **integer piasters** (`Piasters`). Never floats, never pounds in domain code. Convert at the edges with `egp()` / `formatEgp()`.
- Discount and totals logic exists **only** in `@platform/commerce`. The cart and the order API both call it. Never trust a price sent by the client: the API recomputes everything from the catalogue.
- WhatsApp is an optional channel, not the order system (ADR 0007). Cart, pricing and products never depend on it. The order API (`apps/api`, ADR 0008) exists. Admin dashboard, online payment, inventory and read endpoints for orders are NOT built; do not build them, or abstractions for them, until the owner asks. Never expose order reads without authentication (orders contain customers' personal data).
- Orders keep a snapshot of names, unit prices and totals (piasters) as of creation time. The catalogue lives in `packages/commerce/data/catalog.json`; product ids are permanent.
- Product `id` is permanent. A `slug` may change only together with a 301 redirect entry (ADR 0004).

## SEO rules

- Pages are pre-rendered HTML. Titles, canonicals, structured data and content must be in the HTML, not injected by client JS.
- Only the production deployment is indexable. Staging and previews use `robotsDirective()` => `noindex,nofollow`.
- JSON-LD only through `@platform/seo` and serialized with `serializeJsonLd()` (XSS-safe).
- **No `aggregateRating`, `review` or fake social proof, ever.** Only real, verifiable reviews, and only after the owner approves.

## Brand and content rules (non-negotiable)

- Regular belts are **"جلد PU"**. Never write "جلد طبيعي" for them. Natural leather appears only for the bespoke/custom service.
- No Fendi / FF-logo belts. No third-party photos without rights. No invented reviews, ratings, sales counts or testimonials.
- Site language is Arabic (RTL) with Latin digits (0-9).
- Palette: white `#FFFFFF`, berry `#C8102E`, near-black `#161616`.

## Security rules

- **Never ask for, accept, print, or commit tokens, passwords or API keys.** The Meta Conversions API token lives only as the Cloudflare secret `META_TOKEN`. Tracking IDs (GA4, Pixel ID) are public and may live in config.
- `pnpm check:secrets` must pass. If a secret ever lands in git history, tell the owner to rotate it; deleting the commit is not enough.
- Never add `--no-verify`, never disable a CI check to get green.

## Definition of done

1. `pnpm check` passes locally and in CI.
2. New domain logic has tests (pricing, SEO and content helpers are table-tested).
3. Structure changes have an ADR.
4. No new warnings, no TODOs without an owner-visible note in the PR description.
5. Summarize the change to the owner in Arabic, plainly, without jargon.
