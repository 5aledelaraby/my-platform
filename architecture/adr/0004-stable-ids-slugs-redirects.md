# ADR 0004: Stable IDs, changeable slugs, mandatory redirects

Status: accepted

## Context
URLs are the SEO asset. Renaming a product or article slug without a redirect destroys rankings and breaks ads and shared links.

## Decision
- Every product, collection and article has a permanent `id`. The slug is data and may change.
- A slug change must add an entry `{ from, to, status: 301 }` to the redirects list in the same change.
- Slugs are lowercase latin letters, digits and hyphens (validated by `parseArticleFrontmatter`, same rule for products).
- Canonical URLs use a trailing slash for pages and are produced only by `canonicalUrl()`.

## Consequences
- A build-time check will fail if a previously published slug disappears without a redirect (to be added with the first published snapshot).
