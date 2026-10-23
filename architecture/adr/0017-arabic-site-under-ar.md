# ADR 0017: An Arabic version of the store under /ar/

Status: accepted (owner, 2026-10-23). Adds to ADR 0015 (English at the root stays) and ADR 0016 (the bilingual journal).

## Context
ADR 0015 made the site English only on 2026-10-19. On 2026-10-23 the owner asked for an Arabic version as well. The
components already carried Arabic text (every component takes `lang`), and the Arabic journal guides use the Arabic
header and footer, so the work was routing, copy for the home page, and the checks.

## Decision
- English stays at the root and is the default (`x-default`). Arabic is a full copy under `/ar/`, right to left:
  home, belts, design and product pages, cart and checkout, thank-you, favourites, About, Contact and FAQ.
  `langPath(lang, path)` adds the `/ar` prefix for Arabic; `otherLanguagePath(pathname)` gives the same page in the other
  language (`src/site.ts`).
- Only those pages are translated. The policy pages (shipping, returns, terms, privacy, cookies) stay English only
  (owner, 2026-10-20), so the Arabic pages link to the same English page (`policyPath` ignores the language). The journal
  is one shared section with guides in both languages (ADR 0016); an Arabic guide links to the Arabic store pages.
- hreflang: each translated indexable page lists itself, its other-language page and an `x-default` (the English one),
  built by `Base.astro`; `check-dist` verifies both directions. Favourites and thank-you pages stay noindex in both languages.
  The sitemap lists both languages.
- Language switch: "العربية" / "English" in the menu and the footer, leading to the same page in the other language (or
  the other language's home page when the page has one version). The product page keeps it current while colours change.
- The site Worker treats `/ar/collections/vicuna-belts/...` like the English pages: sold-out belts are hidden and a
  sold-out product page redirects to its Arabic design page. Old `/en/...` addresses still answer 301 to the root.
- The cart sends Arabic customers to `/ar/thanks/`. The order API, prices, the catalogue and the catalogue's Arabic names
  are shared; nothing in the API depends on the language.
- Ads, Merchant Center and product keywords keep pointing at the English `/collections/vicuna-belts/...` (ADR 0009); the
  product feed stays English.

## Consequences
- Every new page of the store needs both languages (a page in `src/pages/` and the same one in `src/pages/ar/`) and a
  line in `TRANSLATED` in `src/site.ts`. Text added to a component needs its Arabic next to the English.
- Arabic wording rules in AGENTS.md apply on `/ar/` ("حزام وسط" / "حزام خصر", "جلد PU").
- About 30 more pages are built (87 instead of 56); the JavaScript size is unchanged.

## Update (2026-10-23): hero photo and "how to order" tip
- The home page opens on the owner's collage photo (him with the dress form and a blue belt), which also stays on About,
  instead of the white-dress photo with the header over it. The header is the normal white bar; the words sit under the
  photo. The photo opens the belts page (the blue belt is not a catalogue product).
- A small "how to order" tip (`HowToBuy.astro`, three steps and a WhatsApp link, in both languages) appears 12 seconds
  after a visitor lands on the home, belts, design or product pages, once per visit (`vicuna-howto` in session storage,
  listed in the cookie policy). It never shows over the cart, the menu or the cookie box, nor to someone whose cart
  already has a belt, and it goes away with the close button, Escape, or the first belt added.
