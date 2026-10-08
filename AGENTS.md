# AGENTS.md: rules for any AI agent or developer working in this repo

The owner is Khaled Elaraby (Vicuna, women's waist belts, Egypt). **Always reply to the owner in Arabic.** Keep code, comments and commit messages in English.

## What this repo is

A modular-monolith monorepo (pnpm workspaces) for the Vicuna store: storefront, content/SEO, and later admin and workers. Not microservices. Read `architecture/adr/` before changing structure.

```
apps/website        storefront (Astro SSG + React islands for the cart)
packages/commerce   money, pricing, discounts, cart totals (pure TS, no UI)
packages/seo        canonical, robots policy, sitemap, JSON-LD (pure TS)
packages/content    article/page content model and validation (pure TS)
packages/ui         design-system primitives (no domain knowledge)
content/            products and articles as files (source of truth for now)
tools/architecture  dependency-boundary and secret-scan guards
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
- A new package or a new allowed dependency needs an ADR and an edit to `RULES` in the boundary script, in the same PR.
- Do not create packages "for the future". Extract when a second consumer actually exists.

## Commerce rules

- Money is **integer piasters** (`Piasters`). Never floats, never pounds in domain code. Convert at the edges with `egp()` / `formatEgp()`.
- Discount and totals logic exists **only** in `@platform/commerce`. The browser cart and any server/Worker order validation both call it. Never trust a price sent by the client.
- Orders store a snapshot of prices and discount at creation time.
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
