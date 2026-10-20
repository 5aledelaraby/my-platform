# ADR 0016: A bilingual journal linked from the store, a cleaner repo, and checks for the usual mistakes

Status: accepted (owner, 2026-10-20). Amends ADR 0015 for the journal only: the store stays English only.

## Context
The owner asked for Arabic and English articles that Google can find without putting them in front of shoppers, for
pages to be linked to each other, for anything unused to be removed, and for guards against the mistakes that keep
coming back. Hiding text from visitors while showing it to Google (cloaking, hidden text) breaks Google's spam
policies, so the articles are real pages, just not in the main menu. Before this change the Arabic articles were
linked from no page at all (only the sitemap), and several of them still described InstaPay, WhatsApp orders and one
size for every belt.

## Decision
- Every article says its language (`lang: "ar" | "en"` in its frontmatter, required by `@platform/content`). English and
  Arabic guides share `/journal/style-guides/`; a pair is declared once (`translation:` on one side) and both pages get
  hreflang alternates (with `x-default` on the English one) and a "read in the other language" link. hreflang appears
  only on such pairs; `check-dist` fails on a one-sided pair or an alternate that is not a page.
- The journal is linked, not promoted: the footer ("Journal"), a "Style guides" row on the belts, design and product
  pages (`Guides.astro`, the most relevant guides first), and the FAQ. Each guide links back to the belts it shows.
- `check-dist` also fails on an orphan page (an indexable page no other page links to) and on a missing image.
- `test/articles.test.ts` checks every guide: links only to belts and designs that exist, names only current prices
  and fees, no InstaPay, no "natural leather" for PU belts, and a translation that exists in the other language.
- Removed: the empty `packages/ui` (no consumer since it was created; ROADMAP's rule on frozen units), `MIGRATION.md`
  (the migration is done; git keeps it), a stray screenshot and an empty folder. Unused colour helpers in `store.ts`.
- CI also runs on pushes to `staging`, so a mistake shows up before it is published to the live site.

## Consequences
- 18 guides (9 in each language) instead of 9 Arabic ones; the sitemap lists them all.
- A new guide must name its language, link to existing belts only and use current prices, or the check fails.
- A shared UI package can be created again with `tools/architecture/new-unit.mjs` when a second app needs one.
