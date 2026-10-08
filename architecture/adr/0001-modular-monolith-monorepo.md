# ADR 0001: Modular monolith in a pnpm-workspaces monorepo

Status: accepted

## Context
The store will grow (content, services, admin, background jobs, integrations). The owner is a solo founder building with AI tools. Microservices would multiply deployment, observability and coordination cost with no benefit at this scale.

## Decision
One repo, pnpm workspaces, a few focused packages with enforced dependency directions. Deployable apps live in `apps/*`; reusable logic in `packages/*`. Nx (or Turborepo) can be added later for task caching without restructuring.

## Consequences
- Start with 4 packages (`commerce`, `seo`, `content`, `ui`). `core` and `contracts` are deliberately not created: add them only when a second consumer exists (for example a Worker API and the website sharing request schemas).
- Boundaries are enforced by `tools/architecture/check-boundaries.mjs` in CI, not by convention.
- Packages are source-only (`exports` point at `src/index.ts`); the app bundler compiles them.
