// The store's policy pages: one entry per page and language.
import type { Lang } from "../site.ts";
import { privacyAr, privacyEn } from "./privacy.ts";
import { returnsAr, returnsEn } from "./returns.ts";
import { shippingAr, shippingEn } from "./shipping.ts";
import { termsAr, termsEn } from "./terms.ts";
import type { PolicyDoc, PolicyId } from "./shared.ts";

export { POLICY_IDS, formatPolicyDate, policyPath } from "./shared.ts";
export type { PolicyDoc, PolicyId } from "./shared.ts";

const DOCS: Record<PolicyId, Record<Lang, PolicyDoc>> = {
  shipping: { ar: shippingAr, en: shippingEn },
  returns: { ar: returnsAr, en: returnsEn },
  terms: { ar: termsAr, en: termsEn },
  privacy: { ar: privacyAr, en: privacyEn },
};

export function getPolicy(id: PolicyId, lang: Lang): PolicyDoc {
  return DOCS[id][lang];
}
