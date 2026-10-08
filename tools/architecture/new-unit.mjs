#!/usr/bin/env node
// Scaffolds a new workspace unit with the repo's conventions and registers it in architecture/boundaries.json.
// Zero dependencies.
//
//   node tools/architecture/new-unit.mjs package <name> [--may-import a,b] [--ui]
//   node tools/architecture/new-unit.mjs app <name> [--may-import a,b]
//
// package: pure TypeScript library in packages/<name>, imported as @platform/<name>. Framework-free unless --ui.
// app:     deployable thing in apps/<name> (website, api, worker, admin...). May import packages, never other apps.
//
// Create a unit only when it has a real consumer or deployment (see architecture/ROADMAP.md). Then write an ADR
// if you introduced a new dependency direction.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const boundariesPath = join(root, "architecture/boundaries.json");

const args = process.argv.slice(2);
const kind = args[0];
const name = args[1];
const flag = (f) => args.includes(f);
const mayImportArg = args.indexOf("--may-import");
const mayImport = mayImportArg >= 0 ? (args[mayImportArg + 1] ?? "").split(",").filter(Boolean) : [];

function die(message) {
  console.error(`Error: ${message}`);
  console.error("Usage: node tools/architecture/new-unit.mjs <package|app> <kebab-name> [--may-import a,b] [--ui]");
  process.exit(1);
}

if (kind !== "package" && kind !== "app") die("first argument must be 'package' or 'app'.");
if (!name || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) die("name must be kebab-case (lowercase letters, digits, hyphens).");

const dir = kind === "package" ? `packages/${name}` : `apps/${name}`;
const abs = join(root, dir);
if (existsSync(abs)) die(`${dir} already exists.`);

const config = JSON.parse(readFileSync(boundariesPath, "utf8"));
for (const dep of mayImport) {
  if (!config.units[`packages/${dep}`]) die(`--may-import "${dep}" is not an existing package.`);
}
if (config.units[dir]) die(`${dir} is already registered in boundaries.json.`);

const write = (relPath, content) => {
  const target = join(abs, relPath);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
};

const deps = Object.fromEntries(mayImport.map((d) => [`@platform/${d}`, "workspace:*"]));
const pkg = {
  name: `@platform/${name}`,
  version: "0.0.0",
  private: true,
  type: "module",
  description: "TODO: one sentence on what this unit owns.",
  ...(kind === "package" ? { exports: { ".": "./src/index.ts" } } : {}),
  scripts: { typecheck: "tsc -p tsconfig.json" },
  ...(Object.keys(deps).length ? { dependencies: deps } : {}),
};
write("package.json", JSON.stringify(pkg, null, 2) + "\n");
write(
  "tsconfig.json",
  JSON.stringify({ extends: "../../tsconfig.base.json", compilerOptions: { types: ["node"] }, include: ["src", "test"] }, null, 2) + "\n",
);

if (kind === "package") {
  write("src/index.ts", `// Public API of @platform/${name}. Export only what other units need.\nexport {};\n`);
  write(
    "test/.gitkeep",
    "",
  );
} else {
  write("src/index.ts", `// Entry point of apps/${name}.\nexport {};\n`);
  write(
    "README.md",
    `# apps/${name}\n\nTODO: what this app does, how to run it, where it deploys.\n\nRules: see /AGENTS.md. May import: ${mayImport.map((d) => `@platform/${d}`).join(", ") || "nothing yet"}.\n`,
  );
}

config.units[dir] = { mayImport, frameworkFree: kind === "package" && !flag("--ui") };
const sorted = Object.fromEntries(Object.entries(config.units).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(boundariesPath, JSON.stringify({ ...config, units: sorted }, null, 2) + "\n");

const check = spawnSync(process.execPath, [join(root, "tools/architecture/check-boundaries.mjs")], { encoding: "utf8" });
process.stdout.write(check.stdout);
process.stderr.write(check.stderr);
if (check.status !== 0) {
  console.error(`Created ${dir}, but the architecture check failed. Fix the errors above before committing.`);
  process.exit(1);
}

console.log(`\nCreated ${dir} (${kind}) and registered it in architecture/boundaries.json.`);
console.log("Next: 1) edit the description in package.json  2) add code + tests  3) pnpm install  4) pnpm check");
if (mayImport.length) console.log("You added a dependency direction: record it in a short ADR (architecture/adr/).");
