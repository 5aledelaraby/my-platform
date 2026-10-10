import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, formatEgp } from "@platform/commerce";
import { POLICY_IDS, formatPolicyDate, getPolicy, policyPath } from "../src/policies/index.ts";
import { site } from "../src/site.ts";

const LANGS = ["ar", "en"] as const;
const all = POLICY_IDS.flatMap((id) => LANGS.map((lang) => ({ id, lang, doc: getPolicy(id, lang) })));
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("policy pages", () => {
  it("exist for every policy and language, with a title and a description", () => {
    assert.equal(all.length, 10);
    for (const { id, lang, doc } of all) {
      assert.ok(doc.title.length > 3 && doc.description.length > 20 && doc.html.length > 500, `${id}/${lang}`);
    }
    assert.equal(policyPath("ar", "returns"), "/returns/");
    assert.equal(policyPath("en", "privacy"), "/privacy/");
    assert.equal(policyPath("en", "cookies"), "/privacy/cookies/");
  });

  it("take every number from the shared settings", () => {
    const egp = (v: number) => formatEgp(v);
    const ar = getPolicy("shipping", "ar").html + getPolicy("returns", "ar").html;
    for (const phrase of [
      `${egp(SHIPPING.standard)} جنيه`,
      `${egp(SHIPPING.express)} جنيه`,
      `${egp(SHIPPING.freeOver)} جنيه أو أكثر`,
      `خلال ${site.deliveryDays} أيام عمل`,
      `${site.returnDays} يومًا من يوم استلامه`,
      `خلال ${site.refundDays} أيام من استلامنا`,
      `خلال ${site.defectDays} يومًا من الاستلام`,
      `خلال ${site.lateDeliveryDays} يومًا إذا لم نحدد`,
    ]) {
      assert.ok(ar.includes(phrase), `ar: ${phrase}`);
    }
    const en = getPolicy("shipping", "en").html + getPolicy("returns", "en").html;
    for (const phrase of [
      `EGP ${egp(SHIPPING.standard)}`,
      `EGP ${egp(SHIPPING.express)}`,
      `EGP ${egp(SHIPPING.freeOver)} or more`,
      `within ${site.deliveryDays} working days`,
      `within ${site.returnDays} days of receiving it`,
      `within ${site.refundDays} days of receiving the returned item`,
      `within ${site.defectDays} days of delivery`,
      `within ${site.lateDeliveryDays} days when no date`,
    ]) {
      assert.ok(en.includes(phrase), `en: ${phrase}`);
    }
    for (const lang of LANGS) {
      const terms = getPolicy("terms", lang).html;
      assert.match(terms, lang === "ar" ? /كود الخصم/ : /promo code/i);
      assert.doesNotMatch(terms, /25%|35%/, "the multi-belt offer was withdrawn");
      assert.ok(terms.includes(site.commercialRegister));
      assert.ok(site.taxNumber && terms.includes(site.taxNumber));
      assert.ok(terms.includes(site.consumerAgency.hotline));
    }
  });

  it("have balanced markup and only working internal links", () => {
    const known = new Set(POLICY_IDS.flatMap((id) => LANGS.map((lang) => policyPath(lang, id))));
    for (const { id, lang, doc } of all) {
      for (const tag of ["p", "ul", "li", "h2", "table", "thead", "tbody", "tr", "th", "td", "b", "a", "bdi"]) {
        assert.equal(count(doc.html, new RegExp(`<${tag}[\\s>]`, "g")), count(doc.html, new RegExp(`</${tag}>`, "g")), `${id}/${lang} <${tag}>`);
      }
      for (const [, href] of doc.html.matchAll(/href="([^"]+)"/g)) {
        if (!href?.startsWith("/")) continue;
        const [path = "", hash] = href.split("#");
        assert.ok(known.has(path), `${id}/${lang} links to ${href}`);
        const target = POLICY_IDS.find((p) => policyPath(lang, p) === path);
        assert.ok(target, `${id}/${lang} links to the other language: ${href}`);
        if (hash) assert.ok(getPolicy(target, lang).html.includes(`id="${hash}"`), `${id}/${lang} anchor ${href}`);
      }
    }
  });

  it("follow the brand rules: Latin digits, and natural leather only for made-to-measure belts", () => {
    for (const { id, lang, doc } of all) {
      assert.doesNotMatch(doc.html, /[\u0660-\u0669]/, `${id}/${lang} uses Arabic-Indic digits`);
      if (lang !== "ar") continue;
      for (const block of doc.html.split(/<\/(?:li|p)>/)) {
        if (/جلد طبيعي|الجلد الطبيعي/.test(block)) assert.match(block, /تُفصّل|المفصّلة/, `${id}: natural leather outside made-to-measure`);
      }
    }
    assert.equal(formatPolicyDate("ar", "2026-10-09"), "9 أكتوبر 2026");
  });

  it("the privacy policy names every service that receives order data", () => {
    for (const lang of LANGS) {
      const html = getPolicy("privacy", lang).html;
      for (const service of ["Cloudflare", "Telegram", "WhatsApp", "Gmail", "localStorage"]) assert.ok(html.includes(service), `${lang} ${service}`);
    }
  });
});
