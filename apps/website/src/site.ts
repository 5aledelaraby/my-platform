// Store-wide facts for the website. Change here, rebuild, every page follows.
export const site = {
  url: "https://vicuna-eg.com",
  nameAr: "فيكونا",
  nameEn: "Vicuna",
  email: "info@vicuna-eg.com",
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
  taxNumber: "",
  addressAr: "21 شارع عباس العقاد، مدينة نصر، القاهرة 11371",
  addressEn: "21 Abbas El Akkad street, Nasr City, Cairo 11371, Egypt",
  refundDays: 7,
  deliveryDays: 3,
  returnDays: 14,
  /** Days from delivery to report a defect or a wrong item (Law 181/2018, Art. 21). */
  defectDays: 30,
  /** With no agreed date, an order not delivered within this many days may be cancelled at no cost (Art. 40). */
  lateDeliveryDays: 30,
  /** Working days to answer a request about personal data (Law 151/2020). */
  dataRequestDays: 6,
  /** Egyptian Consumer Protection Agency. */
  consumerAgency: { hotline: "19588", url: "https://cpa.gov.eg" },
  /** Date the policy pages last changed (YYYY-MM-DD). Update with every change to src/policies. */
  policiesUpdated: "2026-10-09",
  maxWeightKg: 90,
  social: [
    { label: "TikTok", href: "https://www.tiktok.com/@elaraby_khaled" },
    { label: "Instagram", href: "https://www.instagram.com/5aled.elaraby" },
    { label: "Snapchat", href: "https://www.snapchat.com/add/khaled-elaraby" },
  ],
} as const;

export type Lang = "ar" | "en";

/** Path prefix for a language: Arabic is at the root, English under /en/. */
export function langPath(lang: Lang, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return lang === "ar" ? clean : `/en${clean}`;
}
