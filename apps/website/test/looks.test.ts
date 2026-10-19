// On-model photos: every listed photo exists in both sizes, the products exist, and no file sits in the folder unlisted.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { catalog } from "@platform/commerce";
import { LOOK_COUNTS, LOOK_IDS, LOOK_SIZES, lookOf, lookStem, looksOf } from "../src/lib/looks.ts";

const dir = new URL("../public/img/looks/", import.meta.url);

describe("look photos", () => {
  it("every listed photo exists in every size, for a product in the catalogue", () => {
    for (const [id, count] of Object.entries(LOOK_COUNTS)) {
      assert.ok(catalog.products.some((p) => p.id === id), `unknown product ${id}`);
      assert.ok(count >= 1, id);
      for (let n = 1; n <= count; n++) {
        for (const w of LOOK_SIZES) assert.ok(existsSync(new URL(`${lookStem(id, n)}-${w}.webp`, dir)), `missing ${lookStem(id, n)}-${w}.webp`);
      }
    }
  });

  it("no file in the folder is left unlisted", () => {
    const expected = new Set(Object.entries(LOOK_COUNTS).flatMap(([id, count]) =>
      Array.from({ length: count }, (_, i) => LOOK_SIZES.map((w) => `${lookStem(id, i + 1)}-${w}.webp`)).flat()));
    for (const f of readdirSync(dir)) assert.ok(expected.has(f), `${f} is not listed in looks.ts`);
  });

  it("products without photos get none; the first photo is the main one", () => {
    // Every belt has a photo now (2026-10-20), so a made-up product stands in for one without.
    const p = { ...catalog.products[0]!, id: "no-photo-yet" };
    assert.equal(LOOK_IDS.has(p.id), false);
    assert.equal(lookOf(p), null);
    assert.deepEqual(looksOf(p), []);
    const many = catalog.products.find((x) => (LOOK_COUNTS[x.id] ?? 0) > 1)!;
    const all = looksOf(many);
    assert.equal(all.length, LOOK_COUNTS[many.id]);
    assert.deepEqual(lookOf(many), all[0]);
    assert.match(all[0]!.srcset, new RegExp(`/${many.id}-640\\.webp 640w, .*/${many.id}-1200\\.webp 1200w$`));
    assert.match(all[1]!.src, new RegExp(`/${many.id}-2-640\\.webp$`));
  });
});
