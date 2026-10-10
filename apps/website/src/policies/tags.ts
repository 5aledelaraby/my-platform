// The analytics and ad tags the policies describe, built from site.ts `tracking`: a tag with no ID is not loaded, so
// the privacy and cookie policies do not mention it either. Cookie lifetimes are the vendors' documented defaults.
import { tracking } from "../site.ts";

export interface TagInfo {
  key: keyof typeof tracking;
  /** The company that receives the data. */
  company: { ar: string; en: string };
  /** The tool's name. */
  tool: { ar: string; en: string };
  /** Where our ads are shown and measured. */
  platforms: string[];
  cookies: Array<{ name: string; ar: string; en: string; lifeAr: string; lifeEn: string }>;
}

const ALL: TagInfo[] = [
  {
    key: "ga4",
    company: { ar: "Google", en: "Google" },
    tool: { ar: "Google Analytics", en: "Google Analytics" },
    platforms: ["Google"],
    cookies: [
      { name: "_ga", ar: "يميّز المتصفح لقياس الزيارات واستخدام الموقع.", en: "tells browsers apart to count visits and how the website is used.", lifeAr: "حتى سنتين.", lifeEn: "Up to 2 years." },
      { name: "_ga_*", ar: "يحفظ حالة الزيارة الحالية لقياس الموقع.", en: "keeps the state of the current visit for the measurement.", lifeAr: "حتى سنتين.", lifeEn: "Up to 2 years." },
    ],
  },
  {
    key: "meta",
    company: { ar: "Meta", en: "Meta" },
    tool: { ar: "Meta Pixel", en: "the Meta Pixel" },
    platforms: ["Facebook", "Instagram"],
    cookies: [
      { name: "_fbp", ar: "قياس الإعلانات وعرضها.", en: "measures and shows our ads.", lifeAr: "حتى 3 أشهر.", lifeEn: "Up to 3 months." },
      { name: "_fbc", ar: "يُحفظ فقط إذا وصلتِ من إعلان على Facebook أو Instagram، لقياس هذا الإعلان.", en: "set only when you arrive from a Facebook or Instagram ad, to measure that ad.", lifeAr: "حتى 3 أشهر.", lifeEn: "Up to 3 months." },
    ],
  },
  {
    key: "tiktok",
    company: { ar: "TikTok", en: "TikTok" },
    tool: { ar: "TikTok Pixel", en: "the TikTok Pixel" },
    platforms: ["TikTok"],
    cookies: [{ name: "_ttp", ar: "قياس الإعلانات وعرضها.", en: "measures and shows our ads.", lifeAr: "حتى 13 شهرًا.", lifeEn: "Up to 13 months." }],
  },
  {
    key: "snapchat",
    company: { ar: "Snap", en: "Snap" },
    tool: { ar: "Snap Pixel", en: "the Snap Pixel" },
    platforms: ["Snapchat"],
    cookies: [{ name: "_scid", ar: "قياس الإعلانات وعرضها.", en: "measures and shows our ads.", lifeAr: "حتى 13 شهرًا.", lifeEn: "Up to 13 months." }],
  },
];

/** The tags that actually load (an ID is set in site.ts). */
export const activeTags = (): TagInfo[] => ALL.filter((t) => Boolean(tracking[t.key]));

/** "A وB وC" */
export const andAr = (items: readonly string[]): string => items.join(" و");
/** "A, B and C" */
export function andEn(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const tagCompanies = (lang: "ar" | "en") => activeTags().map((t) => t.company[lang]);
export const tagTools = (lang: "ar" | "en") => activeTags().map((t) => t.tool[lang]);
export const adPlatforms = () => activeTags().flatMap((t) => t.platforms);
