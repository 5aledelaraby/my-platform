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
  instapay: "01221988192",
  legalNameAr: "فيكونا للتجارة العامة والتصميمات",
  legalNameEn: "Vicuna for General Trading & Designs",
  legalFormAr: "شركة ذات مسئولية محدودة",
  legalFormEn: "limited liability company",
  commercialRegister: "196463",
  /** Tax registration number (Consumer Protection Law 181/2018, Art. 37). Shown on the terms page once set. */
  taxNumber: "704-112-639",
  addressAr: "21 شارع عباس العقاد، مدينة نصر، القاهرة 11371",
  addressEn: "21 Abbas El Akkad street, Nasr City, Cairo 11371, Egypt",
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
  policiesUpdated: "2026-10-10",
  maxWeightKg: 90,
  social: [
    { label: "TikTok", href: "https://www.tiktok.com/@elaraby_khaled" },
    { label: "Instagram", href: "https://www.instagram.com/5aled.elaraby" },
    { label: "Snapchat", href: "https://www.snapchat.com/add/khaled-elaraby" },
  ],
} as const;

/**
 * Analytics and ad tags. Public IDs (not secrets). Empty = not loaded. Nothing loads until the visitor accepts the
 * cookie banner (Consent.astro); the cookie and privacy policies list every tag here.
 */
export const tracking = {
  ga4: "G-PD8H3JF2WR",
  meta: "2311877842998870",
  tiktok: "",
  snapchat: "68610bce-a5fc-4a69-bfb2-c5623a18b560",
} as const;

export type Lang = "ar" | "en";

/** Path prefix for a language: Arabic is at the root, English under /en/. */
export function langPath(lang: Lang, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return lang === "ar" ? clean : `/en${clean}`;
}

/** The articles index (Arabic only for now). */
export const JOURNAL_PATH = "/journal/style-guides/";
