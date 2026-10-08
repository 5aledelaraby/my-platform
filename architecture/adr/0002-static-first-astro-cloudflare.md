# ADR 0002: Static-first storefront (Astro) on Cloudflare, dynamic parts as Workers

Status: accepted, to be validated by the first `apps/website` scaffold

## Context
Product, collection and article pages must be fast and fully crawlable. Orders, inventory, admin and background jobs need a runtime. The domain already sits behind Cloudflare and already runs a Worker (Meta CAPI relay).

## Decision
- Storefront: Astro, pre-rendered HTML (SSG), React islands only for interactive parts (cart, filters).
- Hosting: Cloudflare Pages. Every PR gets a preview deployment; non-production environments are `noindex`.
- Later dynamic needs (NOT in phase 1, see ADR 0007): `apps/api` and `apps/*-worker` as Cloudflare Workers with D1 (data), R2 (media), Queues and Cron Triggers (jobs). No servers to manage.
- Catalogue and articles are files in `content/` until an admin UI creates real demand for a database.

## Consequences
- No client-side-only rendering of SEO-relevant content.
- Content changes require a build; acceptable while changes are infrequent. Revisit with a build hook or incremental approach when an admin dashboard exists.
- If the Astro scaffold shows a blocking problem, this ADR is superseded; the packages are framework-free and survive that change.
