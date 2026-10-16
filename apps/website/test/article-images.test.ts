import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

// Every photo an article points to (its cover and the photos in its text) must exist in public/, so removing an
// old photo can never leave a broken image in an article.
const articles = new URL("../../../content/articles/", import.meta.url);
const pub = new URL("../public/", import.meta.url);

describe("article photos", () => {
  for (const file of readdirSync(articles).filter((f) => f.endsWith(".md"))) {
    it(`${file}: every photo exists`, () => {
      const text = readFileSync(new URL(file, articles), "utf8");
      const srcs = [...text.matchAll(/^image: "([^"]+)"$/gm), ...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]!);
      assert.ok(srcs.length > 0, "no photo found");
      for (const src of srcs) assert.ok(existsSync(new URL(src.replace(/^\//, ""), pub)), `missing ${src}`);
    });
  }
});
