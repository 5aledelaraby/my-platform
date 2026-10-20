import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArticleFrontmatter } from "../src/index.ts";

const valid = {
  lang: "ar" as const,
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
  it("requires a known language", () => {
    assert.throws(() => parseArticleFrontmatter({ ...valid, lang: undefined }), /lang/);
    assert.throws(() => parseArticleFrontmatter({ ...valid, lang: "fr" }), /lang/);
  });
  it("accepts a translation slug, never its own", () => {
    assert.equal(parseArticleFrontmatter({ ...valid, translation: "how-to-tie-a-waist-belt" }).translation, "how-to-tie-a-waist-belt");
    assert.throws(() => parseArticleFrontmatter({ ...valid, translation: valid.slug }), /translation/);
    assert.throws(() => parseArticleFrontmatter({ ...valid, translation: "Not A Slug" }), /translation/);
  });
  it("rejects missing fields and non-objects", () => {
    assert.throws(() => parseArticleFrontmatter({ ...valid, title: "" }), /title/);
    assert.throws(() => parseArticleFrontmatter(null), /object/);
  });
});
