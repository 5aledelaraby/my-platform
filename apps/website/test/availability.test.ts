// Sold-out belts are hidden (ADR 0013): the pure rewrites and the site Worker around them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { catalog } from "@platform/commerce";
import { designPath, hideSoldOut, isSoldOut, productFromPath, productIdFromPath, sitemapWithoutSoldOut, skipSoldOutSiblings } from "../src/lib/availability.ts";
import worker from "../src/worker.ts";

const B = "/collections/vicuna-belts/";
const card = (id: string) => `<article class="card reveal" data-color="red" data-product="${id}" style="--i:0"><a href="${B}${id}/">x</a></article>`;
const swatch = (id: string, current = false) => `<a class="swatch" href="${B}${id}/" style="--c:#000"${current ? ' aria-current="true"' : ""} aria-label="x" title="x"></a>`;
const thinTie = catalog.products.filter((p) => p.style === "thin-tie").map((p) => p.id);

/** The parts of a built product page the Worker rewrites (same markup as ProductPage.astro). */
function productPage(id: string, prev: string, next: string, n: number, total: number): string {
  return [
    `<figure class="pdp-photo" style="--tint:#000" data-swipe-next="${B}${next}/" data-swipe-prev="${B}${prev}/">`,
    `<a class="pdp-arrow prev" href="${B}${prev}/" aria-label="اللون السابق: x"><svg></svg></a>`,
    `<a class="pdp-arrow next" href="${B}${next}/" aria-label="اللون التالي: x"><svg></svg></a>`,
    `<span class="pdp-count" dir="ltr">${n} / ${total}</span></figure>`,
    `<link rel="prefetch" href="${B}${next}/"><link rel="prefetch" href="${B}${prev}/">`,
  ].join("\n");
}

describe("hiding sold-out belts", () => {
  it("finds product pages in both languages and ignores other pages", () => {
    assert.equal(productIdFromPath(`${B}lace-white/`), "lace-white");
    assert.deepEqual(productFromPath(`/en${B}ruffle-red/`)?.en, true);
    assert.equal(productIdFromPath(`${B}thin-tie/`), null, "a style page");
    assert.equal(productIdFromPath(B), null);
    assert.equal(productIdFromPath(`${B}not-a-product/`), null);
  });

  it("sold out only when the product is tracked at zero; untracked products stay", () => {
    assert.equal(isSoldOut({ "lace-white": 0 }, "lace-white"), true);
    assert.equal(isSoldOut({ "lace-white": 3 }, "lace-white"), false);
    assert.equal(isSoldOut({}, "lace-white"), false);
  });

  it("a sold-out product page sends the visitor to its design, in the same language", () => {
    const p = catalog.products.find((x) => x.id === "ruffle-red")!;
    assert.equal(designPath(p, false), `${B}ruffle/`);
    assert.equal(designPath(p, true), `/en${B}ruffle/`);
  });

  it("removes the cards and colour swatches of sold-out belts, and nothing else", () => {
    const html = [card("ruffle-red"), card("ruffle-brown"), swatch("ruffle-red"), swatch("ruffle-brown")].join("\n");
    const out = hideSoldOut(html, ["ruffle-red"]);
    assert.doesNotMatch(out, /data-product="ruffle-red"/);
    assert.doesNotMatch(out, /href="\/collections\/vicuna-belts\/ruffle-red\/"/);
    assert.match(out, /data-product="ruffle-brown"/);
    assert.match(out, /href="\/collections\/vicuna-belts\/ruffle-brown\/"/);
    assert.equal(hideSoldOut(html, []), html);
  });

  it("product photo arrows skip sold-out colours; with no other colour left, arrows and counter go", () => {
    const [a, b, c] = thinTie as [string, string, string];
    const html = productPage(a, thinTie.at(-1)!, b, 1, thinTie.length);
    const out = skipSoldOutSiblings(html, catalog.products.find((p) => p.id === a)!, false, [b]);
    assert.match(out, new RegExp(`class="pdp-arrow next" href="${B}${c}/"`));
    assert.match(out, new RegExp(`data-swipe-next="${B}${c}/"`));
    assert.match(out, new RegExp(`>1 / ${thinTie.length - 1}<`));
    assert.doesNotMatch(out, /rel="prefetch"/);
    const alone = skipSoldOutSiblings(html, catalog.products.find((p) => p.id === a)!, false, thinTie.filter((id) => id !== a));
    assert.doesNotMatch(alone, /pdp-arrow|pdp-count|data-swipe-/);
  });

  it("removes sold-out product pages (both languages) from the sitemap", () => {
    const xml = ["ruffle-red", "ruffle-brown"].flatMap((id) => [`<url><loc>https://vicuna-eg.com${B}${id}/</loc></url>`, `<url><loc>https://vicuna-eg.com/en${B}${id}/</loc></url>`]).join("\n");
    const out = sitemapWithoutSoldOut(xml, ["ruffle-red"]);
    assert.doesNotMatch(out, /ruffle-red/);
    assert.equal((out.match(/ruffle-brown/g) ?? []).length, 2);
  });

  it("the components still have the markup the rewrites look for", () => {
    const read = (f: string) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), "utf8");
    assert.match(read("ProductCard.astro"), /<article class="card reveal" data-color=\{product\.color\} data-product=\{product\.id\}/);
    const page = read("ProductPage.astro");
    assert.match(page, /<a class="swatch big" href=\{beltsUrl\(lang, sib\.id\)\}/);
    for (const re of [/<a class="pdp-arrow prev" href=/, /<a class="pdp-arrow next" href=/, /<span class="pdp-count"/, /data-swipe-next=/, /<link rel="prefetch"/]) assert.match(page, re);
  });
});

describe("site Worker", () => {
  const assets = (body: string, type = "text/html; charset=utf-8") => ({
    fetch: async (req: Request) => {
      assert.equal(req.headers.get("If-None-Match"), null, "conditional headers are removed");
      return new Response(body, { headers: { "Content-Type": type, ETag: '"abc"' } });
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

  it("a sold-out product page redirects to its design", async () => {
    const res = await worker.fetch(get(`${B}ruffle-red/`), { ASSETS: assets("page"), API: api({ "ruffle-red": 0 }) });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("Location"), `${B}ruffle/`);
  });

  it("old /en/ addresses move to the same page at the root for good (English only since 2026-10-19)", async () => {
    for (const [from, to] of [[`/en${B}ruffle-red/`, `${B}ruffle-red/`], ["/en/", "/"], ["/en", "/"], ["/en/privacy/?x=1", "/privacy/?x=1"]] as const) {
      const res = await worker.fetch(get(from), { ASSETS: assets("page"), API: api({}) });
      assert.equal(res.status, 301, from);
      assert.equal(res.headers.get("Location"), to);
    }
    for (const from of ["/collections", "/collections/", "/collections/all/"]) {
      const res = await worker.fetch(get(from), { ASSETS: assets("page"), API: api({}) });
      assert.equal(res.status, 301, from);
      assert.equal(res.headers.get("Location"), B);
    }
    const plain = await worker.fetch(new Request("https://staging.vicuna-eg.com/english/"), { ASSETS: { fetch: async () => new Response("page") }, API: api({}) });
    assert.equal(plain.status, 200, "only /en and /en/... move");
  });

  it("an in-stock product page is served, without ETag and with no-cache", async () => {
    const res = await worker.fetch(get(`${B}ruffle-brown/`), { ASSETS: assets(card("ruffle-brown")), API: api({ "ruffle-brown": 5 }) });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /ruffle-brown/);
    assert.equal(res.headers.get("ETag"), null);
    assert.equal(res.headers.get("Cache-Control"), "no-cache, no-transform");
  });

  it("the belts page loses the sold-out cards", async () => {
    const res = await worker.fetch(get(B), { ASSETS: assets(card("ruffle-red") + card("ruffle-brown")), API: api({ "ruffle-red": 0 }) });
    const html = await res.text();
    assert.doesNotMatch(html, /ruffle-red/);
    assert.match(html, /ruffle-brown/);
  });

  it("API down: pages are served as built", async () => {
    const res = await worker.fetch(get(`${B}ruffle-red/`), { ASSETS: assets(card("ruffle-red")), API: api("down") });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /ruffle-red/);
  });

  it("other paths go straight to the assets, without a stock lookup", async () => {
    let seen = "";
    const res = await worker.fetch(new Request("https://staging.vicuna-eg.com/about/"), {
      ASSETS: { fetch: async (req: Request) => ((seen = new URL(req.url).pathname), new Response("about")) },
      API: { fetch: async () => assert.fail("no stock lookup for other pages") },
    });
    assert.equal(seen, "/about/");
    assert.equal(await res.text(), "about");
  });

  it("pages leave compressed and marked no-transform; other files are untouched", async () => {
    const html = (ae: string) => worker.fetch(new Request("https://staging.vicuna-eg.com/about/", { headers: { "Accept-Encoding": ae } }), {
      ASSETS: { fetch: async () => new Response("<p>about</p>", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" } }) },
    });
    const br = await html("gzip, deflate, br, zstd");
    assert.equal(br.headers.get("Cache-Control"), "public, max-age=0, must-revalidate, no-transform");
    assert.equal(br.headers.get("Content-Encoding"), "br");
    assert.match(br.headers.get("Vary") ?? "", /Accept-Encoding/);
    assert.equal((await html("gzip")).headers.get("Content-Encoding"), "gzip");
    assert.equal((await html("identity")).headers.get("Content-Encoding"), null);
    const css = await worker.fetch(new Request("https://staging.vicuna-eg.com/favicon-48.png"), {
      ASSETS: { fetch: async () => new Response("png", { headers: { "Content-Type": "image/png" } }) },
    });
    assert.equal(css.headers.get("Cache-Control"), null);
    assert.equal(css.headers.get("Content-Encoding"), null);
  });
});
