// The catalog feed for Meta and Google Merchant Center: same columns as the old site, catalogue ids and prices,
// and sold-out rows marked by the site Worker.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { catalog, lookupProduct } from "@platform/commerce";
import { FEED_HEADER, FEED_PATH, buildFeedCsv, feedWithStock } from "../src/lib/feed.ts";
import worker from "../src/worker.ts";

const csv = buildFeedCsv({
  siteUrl: "https://vicuna-eg.com",
  brand: "Vicuna",
  productUrl: (p) => `https://vicuna-eg.com/collections/vicuna-belts/${p.id}/`,
  hasLook: (p) => p.id === "wide-tie-burgundy",
});
const parse = (line: string) => line.slice(1, -1).split('","');
const rows = csv.trim().split("\n").slice(1).map(parse);
const col = (name: (typeof FEED_HEADER)[number]) => FEED_HEADER.indexOf(name);

describe("catalog feed", () => {
  it("keeps the old feed's columns, one row per product, ids = catalogue ids (= Pixel content_ids)", () => {
    assert.equal(csv.split("\n")[0], FEED_HEADER.join(","));
    assert.equal(FEED_HEADER.length, 18);
    assert.deepEqual(rows.map((r) => r[0]), catalog.products.map((p) => p.id));
    for (const r of rows) assert.equal(r.length, FEED_HEADER.length, r[0]);
  });

  it("uses the real prices (croc and snake at their own price) and in stock by default", () => {
    for (const r of rows) {
      const p = lookupProduct(r[0]!);
      assert.equal(r[col("price")], `${(p!.unitPrice / 100).toFixed(2)} EGP`);
      assert.equal(r[col("availability")], "in stock");
    }
    assert.equal(rows.find((r) => r[0] === "thin-tie-croc-black")?.[col("price")], "200.00 EGP");
    assert.equal(rows.find((r) => r[0] === "thin-tie-red")?.[col("price")], "120.00 EGP");
  });

  it("titles name the design and colour, and every image the feed points to exists", () => {
    assert.equal(rows.find((r) => r[0] === "thin-tie-croc-black")?.[col("title")], "حزام عريض برباط رفيع كروكو أسود");
    assert.equal(rows.find((r) => r[0] === "lace-black")?.[col("title")], "حزام دانتيل أسود");
    for (const r of rows) {
      for (const link of [r[col("image_link")], r[col("additional_image_link")]]) {
        if (!link) continue;
        const file = new URL(`../public${new URL(link).pathname}`, import.meta.url);
        assert.ok(existsSync(file), `missing ${link}`);
      }
    }
  });

  it("marks only sold-out rows as out of stock", () => {
    const out = feedWithStock(csv, (id) => id === "lace-gold");
    const after = out.trim().split("\n").slice(1).map(parse);
    assert.equal(after.find((r) => r[0] === "lace-gold")?.[col("availability")], "out of stock");
    assert.equal(after.filter((r) => r[col("availability")] === "out of stock").length, 1);
    assert.equal(feedWithStock(out, (id) => id === "lace-gold"), out, "idempotent");
  });

  it("the site Worker serves the feed with live stock", async () => {
    const res = await worker.fetch(new Request(`https://vicuna-eg.com${FEED_PATH}`), {
      ASSETS: { fetch: async () => new Response(csv, { headers: { "Content-Type": "text/csv", ETag: '"x"' } }) },
      API: { fetch: async () => Response.json({ stock: { "lace-gold": 0, "lace-black": 4 } }) },
    });
    const after = (await res.text()).trim().split("\n").slice(1).map(parse);
    assert.equal(after.find((r) => r[0] === "lace-gold")?.[col("availability")], "out of stock");
    assert.equal(after.find((r) => r[0] === "lace-black")?.[col("availability")], "in stock");
    assert.equal(res.headers.get("ETag"), null);
  });
});
