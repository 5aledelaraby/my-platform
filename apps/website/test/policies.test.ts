import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { SHIPPING, formatEgp } from "@platform/commerce";
import { POLICY_IDS, formatPolicyDate, getPolicy, policyPath } from "../src/policies/index.ts";
import { site, tracking } from "../src/site.ts";

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
    assert.equal(policyPath("en", "privacy"), "/en/privacy/");
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

describe("privacy and cookie policies match what the site really loads and stores", () => {
  const docs = ["privacy", "cookies"] as const;
  const text = (lang: "ar" | "en") => docs.map((id) => getPolicy(id, lang).html).join("\n");

  it("name a tag only when it has an ID in site.ts (so TikTok is not mentioned while its ID is empty)", () => {
    const vendors: Array<[keyof typeof tracking, RegExp]> = [
      ["ga4", /Google Analytics/],
      ["meta", /Meta/],
      ["tiktok", /TikTok|_ttp/],
      ["snapchat", /Snap|_scid/],
    ];
    for (const lang of LANGS) {
      for (const [key, re] of vendors) {
        if (tracking[key]) assert.match(text(lang), re, `${lang}: ${key} is active and must be described`);
        else assert.doesNotMatch(text(lang), re, `${lang}: ${key} has no ID and must not be mentioned`);
      }
    }
  });

  it("list every cookie of the active tags in both languages, including _ga_* and _fbc", () => {
    for (const lang of LANGS) {
      const html = getPolicy("cookies", lang).html;
      if (tracking.ga4) for (const c of ["_ga", "_ga_*"]) assert.ok(html.includes(`${c}</`), `${lang}: ${c}`);
      if (tracking.meta) for (const c of ["_fbp", "_fbc"]) assert.ok(html.includes(`${c}</`), `${lang}: ${c}`);
      if (tracking.snapchat) assert.ok(html.includes("_scid</"), `${lang}: _scid`);
    }
  });

  it("list every key the site saves in the browser", () => {
    const src = new URL("../src/", import.meta.url).pathname;
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((f) => /\.(ts|astro)$/.test(f));
    const keys = new Set<string>();
    for (const f of files) {
      const code = readFileSync(join(src, f), "utf8");
      for (const m of code.matchAll(/(?:KEY\s*=\s*|Storage\.setItem\(\s*)"(vicuna-[a-z0-9-]+)"/g)) keys.add(m[1]!);
      for (const m of code.matchAll(/`(vicuna-[a-z-]+-)\$\{/g)) keys.add(m[1]!);
    }
    assert.ok(keys.size >= 6, `found ${[...keys].join(", ")}`);
    for (const lang of LANGS) {
      const html = getPolicy("cookies", lang).html;
      for (const k of keys) assert.ok(html.includes(k), `${lang}: cookie policy must list ${k}`);
    }
  });
});
