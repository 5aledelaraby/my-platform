// Store-wide facts for the website. Change here, rebuild, every page follows.
export const site = {
  url: "https://vicuna-eg.com",
  nameAr: "فيكونا",
  nameEn: "Vicuna",
  email: "info@vicuna-eg.com",
  /** WhatsApp and phone hours (Cairo time), shown on the contact page. */
  supportHours: { ar: "من 10 صباحًا حتى 10 مساءً بتوقيت القاهرة", en: "10 am to 10 pm, Cairo time" },
  /** Orders, returns and exchanges. */
  supportEmail: "support@vicuna-eg.com",
  whatsappDisplay: "01221988192",
  whatsappInternational: "201221988192",
  legalNameAr: "فيكونا للتجارة العامة والتصميمات",
  legalNameEn: "Vicuna for General Trading & Designs",
  legalFormAr: "شركة ذات مسئولية محدودة",
  legalFormEn: "limited liability company",
  commercialRegister: "196463",
  /** Tax registration number (Consumer Protection Law 181/2018, Art. 37). Shown on the terms page once set. */
  taxNumber: "704-112-639",
  addressAr: "21 شارع عباس العقاد، مدينة نصر، القاهرة 11371",
  addressEn: "21 Abbas El Akkad street, Nasr City, Cairo 11371, Egypt",
  /** The same address split for structured data (Organization). Keep in step with addressAr/addressEn. */
  addressParts: { streetAddress: "21 Abbas El Akkad street", addressLocality: "Nasr City", addressRegion: "Cairo", postalCode: "11371", addressCountry: "EG" },
  refundDays: 7,
  deliveryDays: 3,
  returnDays: 14,
  /** Days from delivery to report a defect or a wrong item (Law 181/2018, Art. 21). */
  defectDays: 30,
  /** With no agreed date, an order not delivered within this many days may be cancelled at no cost (Art. 40). */
  lateDeliveryDays: 30,
  /** Egyptian Consumer Protection Agency. */
  consumerAgency: { hotline: "19588", url: "https://cpa.gov.eg" },
  /** Date the policy pages last changed (YYYY-MM-DD). Update with every change to src/policies. */
  policiesUpdated: "2026-10-23",
  maxWeightKg: 90,
  social: [
    { label: "TikTok", href: "https://www.tiktok.com/@elaraby_khaled" },
    { label: "Instagram", href: "https://www.instagram.com/5aled.elaraby" },
    { label: "Snapchat", href: "https://www.snapchat.com/add/khaled-elaraby" },
  ],
} as const;

/**
 * Analytics and ad tags. Public IDs (not secrets). Empty = not loaded. They load from the first page unless the visitor
 * turned them off in "Cookie settings" (Consent.astro); the cookie and privacy policies list every tag here.
 */
export const tracking = {
  ga4: "G-PD8H3JF2WR",
  meta: "2311877842998870",
  tiktok: "",
  snapchat: "68610bce-a5fc-4a69-bfb2-c5623a18b560",
} as const;

export type Lang = "ar" | "en";

/** The Arabic site lives under this prefix (owner, 2026-10-23, ADR 0017); English stays at the root (ADR 0015). */
export const AR_PREFIX = "/ar";

/**
 * The address of `path` (site-relative, starting with "/") in `lang`: English at the root, Arabic under /ar/. Only the
 * store pages exist in both languages (see `otherLanguagePath`); the policy pages and the journal are shared.
 */
export function langPath(lang: Lang, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return lang === "ar" ? `${AR_PREFIX}${p}` : p;
}

/** Pages that exist in English and Arabic. Everything else (policies, journal, files) is one page for both. */
const TRANSLATED = ["/about/", "/contact/", "/faq/", "/favorites/", "/thanks/", "/collections/vicuna-belts/"];

/**
 * The same page in the other language, for the language switch and hreflang: Arabic pages sit under /ar/, English ones
 * at the root. null for a page that has only one version (policies, journal, 404).
 */
export function otherLanguagePath(pathname: string): { lang: Lang; path: string } | null {
  const arabic = pathname === AR_PREFIX || pathname.startsWith(`${AR_PREFIX}/`);
  const base = arabic ? pathname.slice(AR_PREFIX.length) || "/" : pathname;
  if (base !== "/" && !TRANSLATED.some((t) => base.startsWith(t))) return null;
  return arabic ? { lang: "en", path: base } : { lang: "ar", path: langPath("ar", base) };
}

/** The articles index (Arabic only for now). */
export const JOURNAL_PATH = "/journal/style-guides/";
