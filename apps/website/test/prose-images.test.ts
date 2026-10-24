// Photos in the journal guides' text: the srcset is built only from copies that exist, and every text photo is lazy.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PROSE_SIZES, photoSrcset, proseImagesHtml } from "../src/lib/prose-images.ts";

const pub = mkdtempSync(join(tmpdir(), "vicuna-public-"));
mkdirSync(join(pub, "img/looks"), { recursive: true });
for (const w of [400, 640, 800, 1200]) writeFileSync(join(pub, `img/looks/a-${w}.webp`), "");
writeFileSync(join(pub, "img/looks/alone-1200.webp"), "");

describe("text photos in the journal guides", () => {
  it("lists only the copies that exist, and nothing for other photos", () => {
    const cases: [string, string][] = [
      ["/img/looks/a-1200.webp", "/img/looks/a-400.webp 400w, /img/looks/a-640.webp 640w, /img/looks/a-800.webp 800w, /img/looks/a-1200.webp 1200w"],
      ["/img/looks/alone-1200.webp", ""],
      ["/img/looks/a-800.webp", ""],
      ["https://example.com/img/looks/a-1200.webp", ""],
      ["", ""],
    ];
    for (const [src, want] of cases) assert.equal(photoSrcset(src, pub), want, src);
  });

  it("makes every text photo lazy, adds a srcset when copies exist, and keeps what a photo already has", () => {
    const html = [
      '<p><img src="/img/looks/a-1200.webp" alt="x"></p>',
      '<p><img src="/img/looks/alone-1200.webp" alt="y" /></p>',
      '<p><img src="/img/looks/a-1200.webp" alt="z" loading="eager" srcset="/own.webp 1w"></p>',
    ].join("\n");
    const [a, b, c] = proseImagesHtml(html, pub).split("\n");
    assert.equal(a, `<p><img src="/img/looks/a-1200.webp" alt="x" srcset="${photoSrcset("/img/looks/a-1200.webp", pub)}" sizes="${PROSE_SIZES}" loading="lazy" decoding="async"></p>`);
    assert.equal(b, '<p><img src="/img/looks/alone-1200.webp" alt="y" loading="lazy" decoding="async"></p>');
    assert.equal(c, '<p><img src="/img/looks/a-1200.webp" alt="z" loading="eager" srcset="/own.webp 1w" decoding="async"></p>');
    assert.equal(proseImagesHtml("<p>no photos</p>", pub), "<p>no photos</p>");
  });
});
