// Guards the deployment configs against a TOML trap: a top-level key written after a [table] header
// belongs to that table, and wrangler then silently ignores it (this happened to `routes` once).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const TOP_LEVEL_KEYS = ["name", "main", "compatibility_date", "routes", "workers_dev", "preview_urls", "keep_vars"];

function topLevelViolations(toml: string): string[] {
  const out: string[] = [];
  let seenTable = false;
  // Inside an array of tables ([[ratelimits]] and its sub-tables) "name" is that entry's own key, not the Worker's.
  let arrayTable: string | null = null;
  // Inside [env.<name>] the same keys belong to that environment, which is where they should be.
  let envTable = false;
  for (const line of toml.split("\n")) {
    const header = /^\s*(\[\[?)\s*([^\]]+?)\s*\]/.exec(line);
    if (header) {
      seenTable = true;
      const name = header[2]!;
      envTable = /^env\.[A-Za-z0-9_-]+$/.test(name);
      arrayTable = header[1] === "[[" ? name : arrayTable && name.startsWith(`${arrayTable}.`) ? arrayTable : null;
      continue;
    }
    if (!seenTable || envTable) continue;
    const key = TOP_LEVEL_KEYS.find((k) => new RegExp(`^\\s*${k}\\s*=`).test(line));
    if (key && !(key === "name" && arrayTable)) out.push(line.trim());
  }
  return out;
}

describe("wrangler.toml", () => {
  for (const file of ["../wrangler.toml", "../../website/wrangler.toml"]) {
    it(`${file.replace(/^(\.\.\/)+/, "")} keeps top-level keys above the first [table]`, () => {
      const toml = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.deepEqual(topLevelViolations(toml), []);
      assert.match(toml, /^routes\s*=\s*\[[^\]]*staging\.vicuna-eg\.com/m);
    });
  }

  it("an entry's own name inside an array of tables is not a mistake", () => {
    const ok = 'name = "x"\n[[ratelimits]]\nname = "ORDER_LIMIT"\n  [ratelimits.simple]\n  limit = 5\n';
    assert.deepEqual(topLevelViolations(ok), []);
    assert.deepEqual(topLevelViolations('name = "x"\n[vars]\nname = "y"\n'), ['name = "y"']);
  });

  it("keys of an environment table are not top-level mistakes", () => {
    const ok = 'name = "x"\n[assets]\ndirectory = "./dist"\n[env.production]\nroutes = [{ pattern = "a.example", custom_domain = true }]\nworkers_dev = false\n';
    assert.deepEqual(topLevelViolations(ok), []);
  });

  it("the website's production Worker serves only vicuna-eg.com", () => {
    const toml = readFileSync(new URL("../../website/wrangler.toml", import.meta.url), "utf8");
    const env = toml.slice(toml.indexOf("[env.production]"));
    assert.match(env, /^routes\s*=\s*\[\{ pattern = "vicuna-eg\.com", custom_domain = true \}\]$/m);
    assert.match(env, /^workers_dev\s*=\s*false$/m);
    assert.match(env, /\[\[env\.production\.services\]\]\s*binding = "API"\s*service = "vicuna-api"/);
  });

  it("the check catches the original mistake", () => {
    const broken = 'name = "x"\n[assets]\ndirectory = "./dist"\nroutes = [{ pattern = "a.example", custom_domain = true }]\n';
    assert.deepEqual(topLevelViolations(broken), ['routes = [{ pattern = "a.example", custom_domain = true }]']);
  });
});
