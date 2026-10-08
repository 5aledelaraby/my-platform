# ADR 0005: SEO and trust guardrails

Status: accepted

## Decision
- Only production is indexable. Staging and preview always render `noindex,nofollow` (`robotsDirective`).
- Structured data is generated only by `@platform/seo`, escaped with `serializeJsonLd()`.
- `@platform/seo` has no API for `aggregateRating` or `review`. A test asserts the product JSON-LD never contains them. Real, verified reviews may be added later only by an explicit decision of the owner and a new ADR.
- Titles, descriptions, canonicals and JSON-LD are present in the pre-rendered HTML.
- Planned CI gate on the built output: every page has title, description, canonical, valid JSON-LD; no broken internal links; sitemap lists exactly the indexable pages.

## Rationale
Search engines and Google Merchant Center penalize misleading structured data; the brand rule is no fabricated social proof.
