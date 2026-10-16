// The media and words of every design (style) page and of its panel on the belts collection (owner, 2026-10-16):
// every design gets the "signature pattern" layout. The lead visual always shows the belt worn (owner, 2026-10-17):
// an on-model film or photo; close-up films and photos go lower down. The rest (more films, close-ups) goes into the "on the move" mosaic with the looks.
import type { Lang } from "../site.ts";
import { getProduct, productName } from "../store.ts";
import { looksOf } from "./looks.ts";

type Words = Record<Lang, string>;

export interface Film { kind: "film"; src: string; caption?: Words }
export interface Still { kind: "img"; src: string; sizes: readonly number[]; w: number; h: number; alt: Words; caption: Words }
/** A product's first on-model photo (see lib/looks.ts). */
export interface LookLead { kind: "look"; productId: string }

export interface Design {
  /** The English word set large under the page, and next to "VICUNA" in the kickers. */
  word: string;
  lead: Film | LookLead;
  /** Films for the mosaic: the first opens it, a second one closes it. */
  films: readonly Film[];
  /** Close-up photos for the mosaic. */
  stills: readonly Still[];
  /** Size and fit, as the owner gave them (2026-10-16); empty when not given. Shown small, said once. */
  specs: Record<Lang, readonly string[]>;
}

const still = (src: string, sizes: readonly number[], w: number, h: number, alt: Words, caption: Words): Still =>
  ({ kind: "img", src, sizes, w, h, alt, caption });

export const designs: Readonly<Record<string, Design>> = {
  pattern: {
    word: "SIGNATURE",
    lead: { kind: "film", src: "/video/pattern-brown" },
    films: [
      { kind: "film", src: "/video/pattern-black", caption: { ar: "الأسود، مع فستان أبيض", en: "Black, with a white dress" } },
      { kind: "film", src: "/video/pattern-abaya", caption: { ar: "البني، مع عباية سوداء", en: "Brown, with a black abaya" } },
    ],
    stills: [],
    specs: { ar: [], en: [] },
  },
  lace: {
    word: "LACE",
    lead: { kind: "look", productId: "lace-white" },
    films: [{ kind: "film", src: "/video/lace-detail", caption: { ar: "الدانتيل وفيونكة الساتان عن قرب", en: "The lace and its satin bow, up close" } }],
    stills: [],
    specs: { ar: [], en: [] },
  },
  "wide-tie": {
    word: "WIDE TIE",
    lead: { kind: "film", src: "/video/wide-tie-white" },
    films: [{ kind: "film", src: "/video/belt-detail", caption: { ar: "الرباط العريض عن قرب", en: "The wide tie, up close" } }],
    stills: [],
    specs: { ar: ["العرض 14 سم", "الطول 140 سم"], en: ["14 cm wide", "140 cm long"] },
  },
  "thin-tie": {
    word: "THIN TIE",
    lead: { kind: "film", src: "/video/thin-tie-camel" },
    films: [],
    stills: [
      still("/img/editorial/croc-detail", [640, 1200], 1200, 1200, { ar: "حزام وسط برباط رفيع بنقشة كروكو، صورة مقرّبة", en: "A thin-tie waist belt in croc print, close up" }, { ar: "نقشة الكروكو عن قرب", en: "The croc print, up close" }),
    ],
    specs: { ar: ["العرض 10 سم", "طول البطن 90 سم"], en: ["10 cm wide", "90 cm around the waist"] },
  },
  ruffle: {
    word: "RUFFLE",
    lead: { kind: "look", productId: "ruffle-red" },
    films: [],
    stills: [],
    specs: { ar: ["بداخله أستك يضبط المقاس على الخصر بالتحديد"], en: ["Elastic inside for an exact fit at the waist"] },
  },
};

export function designOf(styleId: string): Design {
  const d = designs[styleId];
  if (!d) throw new Error(`Missing design media for style ${styleId}`);
  return d;
}

const EN_COUNTS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** "لونان" / "Two colours" (a single colour: "اللون" / "The colour"). */
export function colourHeading(lang: Lang, n: number): string {
  return n === 1 ? (lang === "ar" ? "اللون" : "The colour") : colourCount(lang, n);
}

/** "لونان" / "Two colours". */
export function colourCount(lang: Lang, n: number): string {
  if (lang === "en") return `${EN_COUNTS[n] ?? n} colour${n === 1 ? "" : "s"}`;
  if (n === 1) return "لون واحد";
  if (n === 2) return "لونان";
  return n <= 10 ? `${n} ألوان` : `${n} لونًا`;
}

/** The images of a still at every size, for srcset. */
export const stillSrcset = (s: Still): string => s.sizes.map((w) => `${s.src}-${w}.webp ${w}w`).join(", ");
export const stillSrc = (s: Still): string => `${s.src}-${s.sizes[s.sizes.length - 1]}.webp`;

/** The film that opens the home page. */
export const HOME_FILM = "/video/pattern-brown";

/** The poster of a design's lead film (the first thing a page with that film shows), or undefined for a photo lead. */
export function leadPoster(styleId: string): string | undefined {
  const d = designOf(styleId);
  return d.lead.kind === "film" ? `${d.lead.src}.webp` : undefined;
}

/** Widths of a lead film's poster: <film>-360.webp and <film>-540.webp for small tiles, <film>.webp (704) in full. */
export const POSTER_SIZES = [360, 540] as const;
/** The srcset of a lead film's poster, so small tiles fetch a small file. */
export const posterSrcset = (film: string): string =>
  [...POSTER_SIZES.map((w) => `${film}-${w}.webp ${w}w`), `${film}.webp 704w`].join(", ");

/** The lead visual of a design as plain data: its film, or else the on-model photo (4:5) to show instead. */
export function leadOf(styleId: string, lang: Lang): { film?: string; img: { src: string; srcset?: string; w: number; h: number; alt: string } } {
  const d = designOf(styleId);
  if (d.lead.kind === "film") return { film: d.lead.src, img: { src: `${d.lead.src}.webp`, srcset: posterSrcset(d.lead.src), w: 704, h: 1280, alt: "" } };
  const p = getProduct(d.lead.productId);
  const look = p ? looksOf(p)[0] : undefined;
  if (!p || !look) throw new Error(`Design ${styleId}: no on-model photo for ${d.lead.productId}`);
  const name = productName(lang, p);
  return { img: { src: look.src, srcset: look.srcset, w: 640, h: 800, alt: lang === "ar" ? `${name} على الخصر` : `${name}, worn at the waist` } };
}
