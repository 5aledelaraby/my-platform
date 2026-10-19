// What each design (style) needs besides the catalogue: its size and fit, as the owner gave them (2026-10-16), shown
// on the product page. Empty when not given; the product page then shows the usual size.
import type { Lang } from "../site.ts";

export interface Design {
  specs: Record<Lang, readonly string[]>;
}

export const designs: Readonly<Record<string, Design>> = {
  pattern: { specs: { ar: [], en: [] } },
  lace: { specs: { ar: [], en: [] } },
  "wide-tie": { specs: { ar: ["العرض 14 سم", "الطول 140 سم"], en: ["14 cm wide", "140 cm long"] } },
  "thin-tie": { specs: { ar: ["العرض 10 سم", "طول البطن 90 سم"], en: ["10 cm wide", "90 cm around the waist"] } },
  ruffle: { specs: { ar: ["بداخله أستك يضبط المقاس على الخصر بالتحديد"], en: ["Elastic inside for an exact fit at the waist"] } },
};

export function designOf(styleId: string): Design {
  const d = designs[styleId];
  if (!d) throw new Error(`Missing design details for style ${styleId}`);
  return d;
}

const EN_COUNTS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "لونان" / "Two colours". */
export function colourCount(lang: Lang, n: number): string {
  if (lang === "en") return `${EN_COUNTS[n] ?? n} colour${n === 1 ? "" : "s"}`;
  if (n === 1) return "لون واحد";
  if (n === 2) return "لونان";
  return n <= 10 ? `${n} ألوان` : `${n} لونًا`;
}
