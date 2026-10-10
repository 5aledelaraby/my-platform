// Shared facts and helpers for the policy pages (returns, terms, privacy).
//
// The texts are trusted HTML written in this repo (rendered with set:html). They never contain customer input.
// Every number (fees, days, percentages) comes from site.ts or @platform/commerce, so a change there updates the
// pages too. Any new way the site handles personal data (analytics, ad pixels, a new service that receives order
// data) must update privacy.ts in the same change.
import { SHIPPING, formatEgp } from "@platform/commerce";
import { langPath, site } from "../site.ts";
import type { Lang } from "../site.ts";

export const POLICY_IDS = ["shipping", "returns", "terms", "privacy", "cookies"] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

export interface PolicyDoc {
  title: string;
  description: string;
  html: string;
}

export const policyPath = (lang: Lang, id: PolicyId) => langPath(lang, `/${id}/`);

/** Isolates a left-to-right value (phone, email, number) inside Arabic text. */
export const ltr = (text: string | number) => `<bdi dir="ltr">${text}</bdi>`;

export const fees = {
  standard: formatEgp(SHIPPING.standard),
  express: formatEgp(SHIPPING.express),
  freeOver: formatEgp(SHIPPING.freeOver),
};

export const waUrl = (text?: string) =>
  `https://wa.me/${site.whatsappInternational}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function contactHtml(lang: Lang, waText: string, email: string = site.email): string {
  const ar = lang === "ar";
  return `<p>${ar ? "الهاتف وواتساب" : "Phone and WhatsApp"}: <a href="${waUrl(waText)}" rel="noopener noreferrer">${ltr(site.whatsappDisplay)}</a><br>${
    ar ? "البريد الإلكتروني" : "Email"
  }: <a href="mailto:${email}">${ltr(email)}</a></p>`;
}

export function formatPolicyDate(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}
