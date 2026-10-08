import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArticleFrontmatter } from "../src/index.ts";

const valid = {
  title: "كيف تربطين حزام الخصر",
  description: "دليل عملي لربط حزام الخصر بطرق مختلفة مع الفساتين والعباءات.",
  slug: "how-to-tie-wrap-belt",
  datePublished: "2026-10-01",
};

describe("parseArticleFrontmatter", () => {
  it("accepts valid frontmatter", () => {
    assert.deepEqual(parseArticleFrontmatter(valid), valid);
  });
  it("rejects a bad slug", () => {
    assert.throws(() => parseArticleFrontmatter({ ...valid, slug: "Bad Slug" }), /slug/);
  });
  it("rejects a bad date", () => {
    assert.throws(() => parseArticleFrontmatter({ ...valid, datePublished: "1/10/2026" }), /datePublished/);
  });
  it("rejects missing fields and non-objects", () => {
    assert.throws(() => parseArticleFrontmatter({ ...valid, title: "" }), /title/);
    assert.throws(() => parseArticleFrontmatter(null), /object/);
  });
});
