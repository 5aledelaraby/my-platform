// The media and words of every design (style) page and of its panel on the belts collection (owner, 2026-10-16):
// every design gets the "signature pattern" layout. The design's lead visual is its film when it has one, otherwise
// one of its on-model photos. The rest (more films, close-ups) goes into the "on the move" mosaic with the looks.
import type { Lang } from "../site.ts";

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
    lead: { kind: "film", src: "/video/lace-detail" },
    films: [],
    stills: [
      still("/img/editorial/lace-ivory-1", [640, 1200], 1200, 1500, { ar: "حزام وسط دانتيل أبيض بفيونكة ساتان", en: "A white lace waist belt with a satin bow" }, { ar: "الدانتيل الأبيض", en: "White lace" }),
      still("/img/editorial/lace-bow", [640, 1200], 1200, 1200, { ar: "دانتيل الحزام وفيونكة الساتان، صورة مقرّبة", en: "The belt's lace and satin bow, close up" }, { ar: "فيونكة الساتان", en: "The satin bow" }),
      still("/img/editorial/lace-ivory-2", [640, 1200], 1200, 1500, { ar: "فيونكة ساتان على دانتيل أبيض", en: "A satin bow on white lace" }, { ar: "تفاصيل الدانتيل", en: "Lace details" }),
      still("/img/editorial/lace-light", [640, 1200], 1200, 1200, { ar: "دانتيل الحزام في الضوء", en: "The belt's lace in the light" }, { ar: "الدانتيل في الضوء", en: "Lace in the light" }),
    ],
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
