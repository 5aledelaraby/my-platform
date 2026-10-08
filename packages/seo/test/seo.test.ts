import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSitemapXml,
  canonicalUrl,
  productJsonLd,
  robotsDirective,
  serializeJsonLd,
  websiteJsonLd,
} from "../src/index.ts";

describe("robotsDirective", () => {
  it("indexes production only", () => {
    assert.equal(robotsDirective("production"), "index,follow");
    assert.equal(robotsDirective("staging"), "noindex,nofollow");
    assert.equal(robotsDirective("preview"), "noindex,nofollow");
  });
});

describe("canonicalUrl", () => {
  const site = "https://vicuna-eg.com";
  it("normalizes slashes and strips query and hash", () => {
    assert.equal(canonicalUrl(site, "/lace?utm_source=x#top"), "https://vicuna-eg.com/lace/");
    assert.equal(canonicalUrl(site, "lace/"), "https://vicuna-eg.com/lace/");
    assert.equal(canonicalUrl(site, "/"), "https://vicuna-eg.com/");
  });
  it("does not add a trailing slash to file paths", () => {
    assert.equal(canonicalUrl(site, "/sitemap.xml"), "https://vicuna-eg.com/sitemap.xml");
  });
  it("ignores any path on the site URL itself", () => {
    assert.equal(canonicalUrl("https://vicuna-eg.com/ignored", "/a"), "https://vicuna-eg.com/a/");
  });
});

describe("buildSitemapXml", () => {
  it("escapes XML-special characters", () => {
    const xml = buildSitemapXml([{ loc: "https://x.com/a?b=1&c=2", lastmod: "2026-10-01" }]);
    assert.match(xml, /<loc>https:\/\/x\.com\/a\?b=1&amp;c=2<\/loc>/);
    assert.match(xml, /<lastmod>2026-10-01<\/lastmod>/);
  });
});

describe("productJsonLd", () => {
  const base = {
    name: "Belt",
    description: "d",
    url: "https://vicuna-eg.com/p/",
    images: ["https://vicuna-eg.com/i.jpg"],
    sku: "lace-black",
    brand: "Vicuna",
    price: 300,
    currency: "EGP",
    inStock: true,
  };
  it("builds a valid offer and never includes ratings", () => {
    const data = productJsonLd(base);
    const offers = data["offers"] as Record<string, unknown>;
    assert.equal(offers["price"], "300.00");
    assert.equal(offers["priceCurrency"], "EGP");
    assert.equal(offers["availability"], "https://schema.org/InStock");
    assert.equal("aggregateRating" in data, false);
    assert.equal("review" in data, false);
  });
});

describe("serializeJsonLd", () => {
  it("cannot break out of a script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    assert.equal(out.includes("</script>"), false);
    assert.equal(out.includes("<"), false);
    assert.deepEqual(JSON.parse(out), { name: "</script><script>alert(1)</script>" });
  });
});

describe("websiteJsonLd", () => {
  it("describes the site without a search action", () => {
    const data = websiteJsonLd({ name: "Vicuna", url: "https://vicuna-eg.com", language: "ar" });
    assert.equal(data["@type"], "WebSite");
    assert.equal(data["inLanguage"], "ar");
    assert.equal("potentialAction" in data, false);
  });
});
