// The catalog feed for Meta and Google Merchant Center: same columns as the old site, catalogue ids and prices,
// and sold-out rows marked by the site Worker.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { catalog, lookupProduct } from "@platform/commerce";
import { FEED_HEADER, FEED_PATH, LOCAL_FEED_HEADER, LOCAL_FEED_PATH, NOT_IN_FEED, STORE_CODE, buildFeedCsv, buildLocalInventoryCsv, feedWithStock } from "../src/lib/feed.ts";
import worker from "../src/worker.ts";

const csv = buildFeedCsv({
  siteUrl: "https://vicuna-eg.com",
  brand: "Vicuna",
  productUrl: (p) => `https://vicuna-eg.com/collections/vicuna-belts/${p.id}/`,
});
const parse = (line: string) => line.slice(1, -1).split('","');
const rows = csv.trim().split("\n").slice(1).map(parse);
const col = (name: (typeof FEED_HEADER)[number]) => FEED_HEADER.indexOf(name);

describe("catalog feed", () => {
  it("keeps the old feed's columns, one row per product, ids = catalogue ids (= Pixel content_ids)", () => {
    assert.equal(csv.split("\n")[0], FEED_HEADER.join(","));
    assert.equal(FEED_HEADER.length, 19);
    assert.deepEqual(rows.map((r) => r[0]), catalog.products.filter((p) => !NOT_IN_FEED.has(p.style)).map((p) => p.id));
    for (const r of rows) assert.equal(r.length, FEED_HEADER.length, r[0]);
  });

  it("says the belts have no GTIN or MPN (own make)", () => {
    for (const r of rows) assert.equal(r[col("identifier_exists")], "no", r[0]);
  });

  it("uses the real prices (croc and snake at their own price) and in stock by default", () => {
    for (const r of rows) {
      const p = lookupProduct(r[0]!);
      assert.equal(r[col("price")], `${(p!.unitPrice / 100).toFixed(2)} EGP`);
      assert.equal(r[col("availability")], "in stock");
    }
    assert.equal(rows.find((r) => r[0] === "thin-tie-croc-wine")?.[col("price")], "200.00 EGP");
    assert.equal(rows.find((r) => r[0] === "thin-tie-red")?.[col("price")], "120.00 EGP");
  });

  it("titles name the design and colour, and every image the feed points to exists", () => {
    assert.equal(rows.find((r) => r[0] === "thin-tie-croc-wine")?.[col("title")], "حزام عريض برباط رفيع كروكو عنابي");
    assert.equal(rows.find((r) => r[0] === "lace-white")?.[col("title")], "حزام دانتيل أبيض");
    for (const r of rows) {
      for (const link of [r[col("image_link")], r[col("additional_image_link")]]) {
        if (!link) continue;
        const file = new URL(`../public${new URL(link).pathname}`, import.meta.url);
        assert.ok(existsSync(file), `missing ${link}`);
      }
    }
  });

  it("leaves the site-only designs out of the ad catalogue", () => {
    assert.ok(catalog.products.some((p) => p.style === "pattern"), "the pattern belts are in the store");
    assert.equal(rows.some((r) => lookupProduct(r[0]!)?.style === "pattern"), false);
  });

  it("drops only the sold-out rows", () => {
    const out = feedWithStock(csv, (id) => id === "lace-white");
    const after = out.trim().split("\n").slice(1).map(parse);
    assert.equal(after.length, rows.length - 1);
    assert.equal(after.some((r) => r[0] === "lace-white"), false);
    assert.equal(out.split("\n")[0], FEED_HEADER.join(","), "header kept");
    assert.equal(feedWithStock(out, (id) => id === "lace-white"), out, "idempotent");
  });

  it("the site Worker serves the feed with live stock", async () => {
    const res = await worker.fetch(new Request(`https://vicuna-eg.com${FEED_PATH}`), {
      ASSETS: { fetch: async () => new Response(csv, { headers: { "Content-Type": "text/csv", ETag: '"x"' } }) },
      API: { fetch: async () => Response.json({ stock: { "lace-white": 0, "ruffle-red": 4 } }) },
    });
    const after = (await res.text()).trim().split("\n").slice(1).map(parse);
    assert.equal(after.some((r) => r[0] === "lace-white"), false);
    assert.equal(after.find((r) => r[0] === "ruffle-red")?.[col("availability")], "in stock");
    assert.equal(res.headers.get("ETag"), null);
  });

  it("local inventory: the same belts and prices, for pickup at the store, sold-out rows dropped by the Worker", async () => {
    const local = buildLocalInventoryCsv();
    const lrows = local.trim().split("\n").slice(1).map(parse);
    assert.equal(local.split("\n")[0], LOCAL_FEED_HEADER.join(","));
    assert.deepEqual(lrows.map((r) => r[0]), rows.map((r) => r[0]));
    for (const r of lrows) {
      assert.equal(r[1], STORE_CODE);
      assert.equal(r[2], "in_stock");
      assert.equal(r[3], rows.find((m) => m[0] === r[0])?.[col("price")]);
      assert.equal(r[4], "reserve");
    }
    const res = await worker.fetch(new Request(`https://vicuna-eg.com${LOCAL_FEED_PATH}`), {
      ASSETS: { fetch: async () => new Response(local, { headers: { "Content-Type": "text/csv" } }) },
      API: { fetch: async () => Response.json({ stock: { "lace-white": 0 } }) },
    });
    assert.equal((await res.text()).includes('"lace-white"'), false);
  });
});
