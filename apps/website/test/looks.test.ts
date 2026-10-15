// On-model photos: every listed product exists and has both sizes, and no photo sits in the folder unlisted.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { catalog } from "@platform/commerce";
import { LOOK_IDS, LOOK_SIZES, lookOf } from "../src/lib/looks.ts";

const dir = new URL("../public/img/looks/", import.meta.url);

describe("look photos", () => {
  it("every listed product is in the catalogue and has every size", () => {
    for (const id of LOOK_IDS) {
      assert.ok(catalog.products.some((p) => p.id === id), `unknown product ${id}`);
      for (const w of LOOK_SIZES) assert.ok(existsSync(new URL(`${id}-${w}.webp`, dir)), `missing ${id}-${w}.webp`);
    }
  });

  it("no file in the folder is left unlisted", () => {
    for (const f of readdirSync(dir)) {
      const id = f.replace(/-\d+\.webp$/, "");
      assert.ok(LOOK_IDS.has(id), `${f} is not listed in looks.ts`);
    }
  });

  it("products without a photo get none", () => {
    const p = catalog.products.find((x) => !LOOK_IDS.has(x.id))!;
    assert.equal(lookOf(p), null);
    const q = catalog.products.find((x) => LOOK_IDS.has(x.id))!;
    assert.match(lookOf(q)!.srcset, /-640\.webp 640w, .*-1200\.webp 1200w$/);
  });
});
