// Design media: every film named in lib/designs.ts exists with its poster, and lead films also have the small
// poster sizes the tiles use.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { designs, POSTER_SIZES, posterSrcset } from "../src/lib/designs.ts";

const pub = new URL("../public", import.meta.url).pathname;
const has = (path: string) => existsSync(pub + path);

describe("design media", () => {
  it("every film has its video and poster", () => {
    for (const [id, d] of Object.entries(designs)) {
      const films = [...(d.lead.kind === "film" ? [d.lead] : []), ...d.films];
      for (const f of films) {
        assert.ok(has(`${f.src}.mp4`), `${id}: missing ${f.src}.mp4`);
        assert.ok(has(`${f.src}.webp`), `${id}: missing ${f.src}.webp`);
      }
    }
  });

  it("lead films have every small poster size", () => {
    for (const [id, d] of Object.entries(designs)) {
      if (d.lead.kind !== "film") continue;
      for (const w of POSTER_SIZES) assert.ok(has(`${d.lead.src}-${w}.webp`), `${id}: missing ${d.lead.src}-${w}.webp`);
      assert.match(posterSrcset(d.lead.src), new RegExp(`-360\\.webp 360w, .*-540\\.webp 540w, .*${d.lead.src}\\.webp 704w$`));
    }
  });
});
