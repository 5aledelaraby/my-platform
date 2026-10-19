# ADR 0015: English only, one calm look, and a light home page that leads to the belts

Status: accepted (owner, 2026-10-19). Supersedes the language parts of ADR 0009 (Arabic at the root, English under
`/en/` with hreflang alternates). Confirms ADR 0009's rule that `/` is not the store.

## Context
On 2026-10-19 the owner asked for the site in English only, in the layout and typeface of a quiet fashion store he
showed (casasancho.com), in calm colours on white, with the on-model photo first everywhere. Earlier the same day he
asked for the home page to sell (product cards); by the evening he asked for the opposite: a light, simple home page
that is not a sales page, where every photo leads to the belts. He also said most customers shop on a phone.

## Decision
- One language: English at the root. `langPath` returns the plain path; old `/en/...` addresses answer 301 to the root
  (`src/worker.ts`); no hreflang alternates (`check-dist` fails if one appears or a page is built under `/en/`). The
  Arabic articles under `/journal/style-guides/` stay for search, out of the menus.
- `/` is light: the white-dress photo with the signature pattern belt, one line about the brand, the lace white photo,
  then the designs as large words with their on-model photos in a row that slides sideways (each photo opens its
  belt), and a link to all belts. No product grid and no "add to cart" on `/`. The photo rows are product cards for the
  site Worker, so a sold-out belt's photos leave the home page too (ADR 0013).
- `/collections/vicuna-belts/` opens on the olive kimono photo, then every belt; each design
  page is the same collection layout filtered to that design.
- One look, written once: `src/styles/global.css` holds only the current look (no older layers, no dark mode, no
  sparkles or neon), phones first. The stylesheet is inlined in every page, so its size is page weight.
- The lace white on-model photo is the default link preview (og:image).

## Consequences
- The stylesheet went from about 128 KB to about 28 KB per page; films and photos no page used were removed.
- Ads, Merchant Center and product keywords keep pointing at `/collections/vicuna-belts/...` (ADR 0009).
- The product feed and policies are in English; the Merchant Center data source language must match.

## Update (2026-10-20): the final pass
- The home header sits on the hero photo and turns into the white bar on scroll; "Transform your dress" is written on
  the lace white photo; the footer carries the owner's dark bow photo with the words in white.
- The policy pages are English only (the Arabic texts are removed from the code), and the terms are short.
- Analytics and ad tags load only on the live site (`DEPLOY_ENV=production`), so staging tests never reach Google
  Analytics, Meta or Snap.

