// Guards the deployment configs against a TOML trap: a top-level key written after a [table] header
// belongs to that table, and wrangler then silently ignores it (this happened to `routes` once).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const TOP_LEVEL_KEYS = ["name", "main", "compatibility_date", "routes", "workers_dev", "preview_urls", "keep_vars"];

function topLevelViolations(toml: string): string[] {
  const lines = toml.split("\n");
  const firstTable = lines.findIndex((l) => /^\s*\[/.test(l));
  if (firstTable < 0) return [];
  return lines
    .slice(firstTable)
    .filter((l) => TOP_LEVEL_KEYS.some((k) => new RegExp(`^\\s*${k}\\s*=`).test(l)))
    .map((l) => l.trim());
}

describe("wrangler.toml", () => {
  for (const file of ["../wrangler.toml", "../../website/wrangler.toml"]) {
    it(`${file.replace(/^(\.\.\/)+/, "")} keeps top-level keys above the first [table]`, () => {
      const toml = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.deepEqual(topLevelViolations(toml), []);
      assert.match(toml, /^routes\s*=\s*\[[^\]]*staging\.vicuna-eg\.com/m);
    });
  }

  it("the check catches the original mistake", () => {
    const broken = 'name = "x"\n[assets]\ndirectory = "./dist"\nroutes = [{ pattern = "a.example", custom_domain = true }]\n';
    assert.deepEqual(topLevelViolations(broken), ['routes = [{ pattern = "a.example", custom_domain = true }]']);
  });
});
