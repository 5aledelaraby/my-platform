// Content-hashed asset addresses: pages link photos, films and the logo by a versioned path that changes with the file.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerprintHtml, versionedPath } from "../src/lib/fingerprint.ts";

const hashes: Record<string, string> = {
  "/img/a-640.webp": "aaaa",
  "/img/a-1200.webp": "bbbb",
  "/video/film.webp": "cccc",
  "/video/film.mp4": "dddd",
  "/brand/mark-96.webp": "eeee",
};
const hashOf = (p: string) => hashes[p];

describe("fingerprint", () => {
  it("rewrites src, srcset, poster, preload and JSON paths", () => {
    const html = [
      `<img src="/img/a-640.webp" srcset="/img/a-640.webp 640w, /img/a-1200.webp 1200w">`,
      `<video src="/video/film.mp4" poster="/video/film.webp" data-poster='/video/film.webp'></video>`,
      `<link rel="preload" href="/brand/mark-96.webp">`,
      `<script type="application/json">{"image":"/img/a-1200.webp"}</script>`,
    ].join("\n");
    const { html: out, used } = fingerprintHtml(html, hashOf);
    assert.ok(out.includes(`src="/v/aaaa/img/a-640.webp"`));
    assert.ok(out.includes(`srcset="/v/aaaa/img/a-640.webp 640w, /v/bbbb/img/a-1200.webp 1200w"`));
    assert.ok(out.includes(`src="/v/dddd/video/film.mp4" poster="/v/cccc/video/film.webp" data-poster='/v/cccc/video/film.webp'`));
    assert.ok(out.includes(`href="/v/eeee/brand/mark-96.webp"`));
    assert.ok(out.includes(`"image":"/v/bbbb/img/a-1200.webp"`));
    assert.equal(used.size, 5);
  });

  it("leaves absolute URLs, fonts, other folders and missing files alone", () => {
    const html = `<meta property="og:image" content="https://vicuna-eg.com/img/a-1200.webp"><link href="/fonts/x.woff2"><img src="/catalog/img/a.jpg"><img src="/img/missing.webp">`;
    const { html: out, used } = fingerprintHtml(html, hashOf);
    assert.equal(out, html);
    assert.equal(used.size, 0);
  });

  it("is idempotent: a versioned path is not versioned again", () => {
    const once = fingerprintHtml(`<img src="/img/a-640.webp">`, hashOf).html;
    assert.equal(fingerprintHtml(once, hashOf).html, once);
  });

  it("puts the hash before the original path", () => {
    assert.equal(versionedPath("/img/x.webp", "12ab"), "/v/12ab/img/x.webp");
  });
});
