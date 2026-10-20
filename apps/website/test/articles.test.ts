// The journal guides (content/articles/*.md) are written by hand, so these checks catch the usual mistakes before they
// go live: a link to a belt or design that no longer exists, a price or fee that changed, a payment method we no longer
// offer, "natural leather" for a PU belt (AGENTS.md), or a translation that points nowhere.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SHIPPING, priceOf } from "@platform/commerce";
import { products, styles } from "../src/store.ts";

const dir = new URL("../../../content/articles/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
const read = (f: string) => readFileSync(new URL(f, dir), "utf8");
const field = (text: string, key: string) => new RegExp(`^${key}: "([^"]*)"$`, "m").exec(text)?.[1];

const ids = new Set([...styles.map((s) => s.id), ...products.map((p) => p.id)]);
// Every amount an article may name, in pounds: belt prices and the shipping fees.
const pounds = (piasters: number) => String(piasters / 100);
const amounts = new Set([
  ...styles.map((s) => pounds(s.price)),
  ...products.map((p) => pounds(priceOf(p))),
  pounds(SHIPPING.standard),
  pounds(SHIPPING.express),
  pounds(SHIPPING.freeOver),
]);
const banned: [RegExp, string][] = [
  [/جلد طبيعي|genuine leather|real leather|natural leather/i, "regular belts are PU leather (AGENTS.md); natural leather is only the bespoke service"],
  [/إنستاباي|انستاباي|instapay/i, "InstaPay is no longer offered (2026-10-18): cash on delivery or PayPal"],
];

describe("journal guides", () => {
  it("there are guides in both languages", () => {
    const langs = new Set(files.map((f) => field(read(f), "lang")));
    assert.deepEqual([...langs].sort(), ["ar", "en"]);
  });

  for (const f of files) {
    const text = read(f);
    describe(f, () => {
      it("links only to belts and designs that exist", () => {
        for (const m of text.matchAll(/\/collections\/vicuna-belts\/([a-z0-9-]+)\//g)) assert.ok(ids.has(m[1]!), `unknown belt or design "${m[1]}"`);
        for (const m of text.matchAll(/^ {2}- ([a-z0-9-]+)$/gm)) assert.ok(ids.has(m[1]!), `products: unknown belt "${m[1]}"`);
      });
      it("names only current prices and fees", () => {
        const found = [...text.matchAll(/(\d[\d,]*)\s*جنيه|(?:EGP|LE)\s*(\d[\d,]*)/g)].map((m) => (m[1] ?? m[2] ?? "").replace(/,/g, ""));
        for (const n of found) assert.ok(amounts.has(n), `${n} is not a current price or fee (${[...amounts].join(", ")})`);
      });
      it("says nothing the rules forbid", () => {
        for (const [re, why] of banned) assert.ok(!re.test(text), why);
      });
      it("its translation exists and is in the other language", () => {
        const t = field(text, "translation");
        if (!t) return;
        assert.ok(files.includes(`${t}.md`), `translation ${t} does not exist`);
        assert.notEqual(field(read(`${t}.md`), "lang"), field(text, "lang"));
      });
    });
  }
});
