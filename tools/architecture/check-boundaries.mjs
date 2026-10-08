#!/usr/bin/env node
// Architecture guard. Zero dependencies, runs on plain Node, enforced in CI.
//
// Rules:
//  1. Every unit under apps/* and packages/* must be declared in RULES below (no silent new modules).
//  2. A unit may import only the internal packages listed in its `mayImport`.
//  3. Internal packages are imported by name only (@platform/x), never by deep path or relative path.
//  4. Relative imports must stay inside the unit.
//  5. Domain packages must not import UI frameworks (`forbiddenExternal`).
//  6. Every internal import must be declared in the unit's package.json dependencies.
//  7. The declared dependency graph must have no cycles.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const SCOPE = "@platform/";
const UI_FRAMEWORKS = ["react", "react-dom", "preact", "astro", "vue", "svelte", "solid-js"];

/** The single source of truth for allowed dependencies. Change it deliberately, with an ADR. */
const RULES = {
  "packages/commerce": { mayImport: [], forbiddenExternal: UI_FRAMEWORKS },
  "packages/seo": { mayImport: [], forbiddenExternal: UI_FRAMEWORKS },
  "packages/content": { mayImport: [], forbiddenExternal: UI_FRAMEWORKS },
  "packages/ui": { mayImport: [], forbiddenExternal: [] },
  "apps/website": { mayImport: ["commerce", "seo", "content", "ui"], forbiddenExternal: [] },
};

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|astro)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", ".wrangler", "coverage"]);
const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const errors = [];
const fail = (message) => errors.push(message);

function listDirs(base) {
  const dir = join(root, base);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .map((name) => `${base}/${name}`);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.test(name)) yield full;
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

const units = [...listDirs("apps"), ...listDirs("packages")];

// Rule 1
for (const unit of units) {
  if (!(unit in RULES)) fail(`${unit}: not declared in RULES (tools/architecture/check-boundaries.mjs). Add it deliberately, with an ADR.`);
}
for (const unit of Object.keys(RULES)) {
  if (!units.includes(unit)) fail(`${unit}: declared in RULES but the folder does not exist.`);
}

const nameToUnit = new Map(Object.keys(RULES).map((unit) => [unit.split("/")[1], unit]));

for (const unit of units) {
  const rule = RULES[unit];
  if (!rule) continue;
  const unitDir = join(root, unit);

  let declared = new Set();
  const pkgPath = join(unitDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    declared = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }));
  } else {
    fail(`${unit}: missing package.json`);
  }

  for (const file of walk(unitDir)) {
    const text = readFileSync(file, "utf8");
    const shown = relative(root, file).split(sep).join("/");
    for (const match of text.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;
      const where = `${shown}:${lineOf(text, match.index ?? 0)}`;

      if (spec.startsWith(".")) {
        // Rules 3 + 4
        const target = resolve(dirname(file), spec);
        if (target !== unitDir && !target.startsWith(unitDir + sep)) {
          fail(`${where}: relative import "${spec}" escapes ${unit}. Import other packages by name (${SCOPE}x).`);
        }
        continue;
      }

      if (spec.startsWith(SCOPE)) {
        const [name, ...deep] = spec.slice(SCOPE.length).split("/");
        if (deep.length > 0) fail(`${where}: deep import "${spec}". Import "${SCOPE}${name}" only.`);
        if (!nameToUnit.has(name)) fail(`${where}: unknown internal package "${SCOPE}${name}".`);
        else if (nameToUnit.get(name) !== unit) {
          // Rule 2
          if (!rule.mayImport.includes(name)) {
            fail(`${where}: ${unit} may not import ${SCOPE}${name}. Allowed: [${rule.mayImport.join(", ") || "none"}].`);
          }
          // Rule 6
          if (!declared.has(`${SCOPE}${name}`)) {
            fail(`${where}: ${SCOPE}${name} is not declared in ${unit}/package.json dependencies.`);
          }
        }
        continue;
      }

      // Rule 5 (external packages; node: builtins are always fine)
      const bare = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (rule.forbiddenExternal.includes(bare)) {
        fail(`${where}: ${unit} must not import "${bare}" (domain code stays framework-free).`);
      }
    }
  }
}

// Rule 7: cycles in the declared graph
const visiting = new Set();
const done = new Set();
function visit(unit, trail) {
  if (done.has(unit)) return;
  if (visiting.has(unit)) {
    fail(`dependency cycle: ${[...trail, unit].join(" -> ")}`);
    return;
  }
  visiting.add(unit);
  for (const name of RULES[unit]?.mayImport ?? []) {
    const next = nameToUnit.get(name);
    if (next) visit(next, [...trail, unit]);
  }
  visiting.delete(unit);
  done.add(unit);
}
for (const unit of Object.keys(RULES)) visit(unit, []);

if (errors.length > 0) {
  console.error(`Architecture check failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Architecture check passed (${units.length} units).`);
