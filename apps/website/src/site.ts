// Store-wide facts for the website. Change here, rebuild, every page follows.
export const site = {
  url: "https://vicuna-eg.com",
  nameAr: "فيكونا",
  nameEn: "Vicuna",
  email: "info@vicuna-eg.com",
  whatsappDisplay: "01221988192",
  whatsappInternational: "201221988192",
  deliveryDays: 3,
  returnDays: 14,
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
