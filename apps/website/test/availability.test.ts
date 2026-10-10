// Live availability on product pages (ADR 0013): the pure rewrite and the site Worker around it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { productJsonLd, serializeJsonLd } from "@platform/seo";
import { IN_STOCK, OUT_OF_STOCK, isSoldOut, markSoldOut, productIdFromPath, statedAvailability } from "../src/lib/availability.ts";
import worker from "../src/worker.ts";

/** The parts of a built product page that carry the stock state (same markup as ProductPage.astro). */
function productPage(id: string): string {
  const ld = serializeJsonLd(
    productJsonLd({ name: "x", description: "x", url: `https://vicuna-eg.com/collections/vicuna-belts/${id}/`, images: [], sku: id, brand: "Vicuna", price: 300, currency: "EGP", inStock: true }),
  );
  return [
    `<script type="application/ld+json">${ld}</script>`,
    `<p class="soldout" data-soldout-for="${id}" hidden>نفدت الكمية</p>`,
    `<button type="button" class="btn btn-berry btn-block" data-add="${id}">أضيفي للسلة</button>`,
    // a related card for another product must stay untouched
    `<span class="card-out" data-soldout-for="lace-red" hidden>x</span><button type="button" class="quick-add" data-add="lace-red">x</button>`,
  ].join("\n");
}

describe("availability rules", () => {
  it("finds product pages in both languages and ignores other pages", () => {
    assert.equal(productIdFromPath("/collections/vicuna-belts/lace-gold/"), "lace-gold");
    assert.equal(productIdFromPath("/en/collections/vicuna-belts/thin-tie-croc-black/"), "thin-tie-croc-black");
    assert.equal(productIdFromPath("/collections/vicuna-belts/thin-tie/"), null, "a style page");
    assert.equal(productIdFromPath("/collections/vicuna-belts/"), null);
    assert.equal(productIdFromPath("/collections/vicuna-belts/not-a-product/"), null);
  });

  it("sold out only when the product is tracked at zero; untracked products stay available", () => {
    assert.equal(isSoldOut({ "lace-gold": 0 }, "lace-gold"), true);
    assert.equal(isSoldOut({ "lace-gold": 3 }, "lace-gold"), false);
    assert.equal(isSoldOut({}, "lace-gold"), false);
  });

  it("a sold-out page says OutOfStock and shows the sold-out state; the visible state and the data agree", () => {
    const html = markSoldOut(productPage("lace-gold"), "lace-gold");
    assert.equal(statedAvailability(html), OUT_OF_STOCK);
    assert.match(html, /<p class="soldout" data-soldout-for="lace-gold">/);
    assert.match(html, /<button disabled type="button" class="btn btn-berry btn-block" data-add="lace-gold">/);
    // the other product on the page is not touched
    assert.match(html, /data-soldout-for="lace-red" hidden>/);
    assert.match(html, /<button type="button" class="quick-add" data-add="lace-red">/);
    // idempotent
    assert.equal(markSoldOut(html, "lace-gold"), html);
  });

  it("the built page states InStock (the Worker only ever changes it to OutOfStock)", () => {
    assert.equal(statedAvailability(productPage("lace-gold")), IN_STOCK);
  });

  it("ProductPage.astro still has the markup the rewrite looks for", () => {
    const src = readFileSync(new URL("../src/components/ProductPage.astro", import.meta.url), "utf8");
    assert.match(src, /data-soldout-for=\{product\.id\} hidden>/);
    assert.match(src, /<button type="button"[^>]*data-add=\{product\.id\}>/);
    assert.match(src, /inStock: true/);
  });
});

describe("site Worker", () => {
  const asset = (id: string) => ({
    fetch: async (req: Request) => {
      assert.equal(req.headers.get("If-None-Match"), null, "conditional headers are removed");
      return new Response(productPage(id), { headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"abc"' } });
    },
  });
  const api = (stock: Record<string, number> | "down") => ({
    fetch: async (req: Request) => {
      assert.equal(new URL(req.url).pathname, "/api/stock");
      if (stock === "down") throw new Error("unreachable");
      return Response.json({ stock });
    },
  });
  const get = (path: string) => new Request(`https://staging.vicuna-eg.com${path}`, { headers: { "If-None-Match": '"abc"' } });

  it("in stock: the page is served as built, InStock, button enabled", async () => {
    const res = await worker.fetch(get("/collections/vicuna-belts/wide-tie-gold/"), { ASSETS: asset("wide-tie-gold"), API: api({ "wide-tie-gold": 5 }) });
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.equal(statedAvailability(html), IN_STOCK);
    assert.match(html, /data-soldout-for="wide-tie-gold" hidden>/);
    assert.equal(res.headers.get("ETag"), null);
    assert.equal(res.headers.get("Cache-Control"), "no-cache");
  });

  it("sold out (English page too): OutOfStock, message shown, button disabled", async () => {
    const res = await worker.fetch(get("/en/collections/vicuna-belts/lace-gold/"), { ASSETS: asset("lace-gold"), API: api({ "lace-gold": 0 }) });
    const html = await res.text();
    assert.equal(statedAvailability(html), OUT_OF_STOCK);
    assert.match(html, /data-soldout-for="lace-gold">/);
    assert.match(html, /<button disabled[^>]*data-add="lace-gold"/);
  });

  it("API down: the page is still served (as built)", async () => {
    const res = await worker.fetch(get("/collections/vicuna-belts/lace-gold/"), { ASSETS: asset("lace-gold"), API: api("down") });
    assert.equal(res.status, 200);
    assert.equal(statedAvailability(await res.text()), IN_STOCK);
  });

  it("other paths go straight to the assets", async () => {
    let seen = "";
    const res = await worker.fetch(new Request("https://staging.vicuna-eg.com/collections/vicuna-belts/thin-tie/"), {
      ASSETS: { fetch: async (req: Request) => ((seen = new URL(req.url).pathname), new Response("style page")) },
      API: { fetch: async () => assert.fail("no stock lookup for a style page") },
    });
    assert.equal(seen, "/collections/vicuna-belts/thin-tie/");
    assert.equal(await res.text(), "style page");
  });
});
