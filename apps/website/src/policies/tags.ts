// The analytics and ad tags the policies describe, built from site.ts `tracking`: a tag with no ID is not loaded, so
// the privacy and cookie policies do not mention it either. Cookie lifetimes are the vendors' documented defaults.
import { tracking } from "../site.ts";

export interface TagInfo {
  key: keyof typeof tracking;
  /** The company that receives the data. */
  company: string;
  /** The tool's name. */
  tool: string;
  /** Where our ads are shown and measured. */
  platforms: string[];
  cookies: Array<{ name: string; what: string; life: string }>;
}

const ALL: TagInfo[] = [
  {
    key: "ga4",
    company: "Google",
    tool: "Google Analytics",
    platforms: ["Google"],
    cookies: [
      { name: "_ga", what: "tells browsers apart to count visits and how the website is used.", life: "Up to 2 years." },
      { name: "_ga_*", what: "keeps the state of the current visit for the measurement.", life: "Up to 2 years." },
    ],
  },
  {
    key: "meta",
    company: "Meta",
    tool: "the Meta Pixel",
    platforms: ["Facebook", "Instagram"],
    cookies: [
      { name: "_fbp", what: "measures and shows our ads.", life: "Up to 3 months." },
      { name: "_fbc", what: "set only when you arrive from a Facebook or Instagram ad, to measure that ad.", life: "Up to 3 months." },
    ],
  },
  {
    key: "tiktok",
    company: "TikTok",
    tool: "the TikTok Pixel",
    platforms: ["TikTok"],
    cookies: [{ name: "_ttp", what: "measures and shows our ads.", life: "Up to 13 months." }],
  },
  {
    key: "snapchat",
    company: "Snap",
    tool: "the Snap Pixel",
    platforms: ["Snapchat"],
    cookies: [{ name: "_scid", what: "measures and shows our ads.", life: "Up to 13 months." }],
  },
];

/** The tags that actually load (an ID is set in site.ts). */
export const activeTags = (): TagInfo[] => ALL.filter((t) => Boolean(tracking[t.key]));

/** "A, B and C" */
export function andEn(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const tagCompanies = () => activeTags().map((t) => t.company);
export const tagTools = () => activeTags().map((t) => t.tool);
export const adPlatforms = () => activeTags().flatMap((t) => t.platforms);
