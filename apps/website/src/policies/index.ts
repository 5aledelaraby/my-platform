// The store's policy pages, English only (owner, 2026-10-20): one entry per page.
import { cookiesEn } from "./cookies.ts";
import { privacyEn } from "./privacy.ts";
import { returnsEn } from "./returns.ts";
import { shippingEn } from "./shipping.ts";
import { termsEn } from "./terms.ts";
import type { PolicyDoc, PolicyId } from "./shared.ts";

export { POLICY_IDS, formatPolicyDate, policyPath } from "./shared.ts";
export type { PolicyDoc, PolicyId } from "./shared.ts";

const DOCS: Record<PolicyId, PolicyDoc> = {
  shipping: shippingEn,
  returns: returnsEn,
  terms: termsEn,
  privacy: privacyEn,
  cookies: cookiesEn,
};

/** The page (English; the Arabic article pages link to the same English pages). */
export function getPolicy(id: PolicyId): PolicyDoc {
  return DOCS[id];
}
