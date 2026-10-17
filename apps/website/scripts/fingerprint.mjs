// Post-build: gives the photos, films and logo the pages link to a content-hashed address (src/lib/fingerprint.ts),
// so they can be cached for a year. Runs after `astro build`, before check-dist.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fingerprintHtml, versionedPath } from "../src/lib/fingerprint.ts";

const DIST = new URL("../dist/", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const hashes = new Map();
function hashOf(path) {
  if (hashes.has(path)) return hashes.get(path);
  const file = join(DIST, path);
  const hash = existsSync(file) && statSync(file).isFile() ? createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10) : undefined;
  hashes.set(path, hash);
  return hash;
}

const copied = new Set();
let pages = 0;
for (const file of walk(DIST).filter((f) => f.endsWith(".html"))) {
  const { html, used } = fingerprintHtml(readFileSync(file, "utf8"), hashOf);
  if (used.size === 0) continue;
  writeFileSync(file, html);
  pages++;
  for (const [path, hash] of used) {
    const target = join(DIST, versionedPath(path, hash));
    if (copied.has(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(DIST, path), target);
    copied.add(target);
  }
}
console.log(`fingerprint: ${copied.size} files versioned, ${pages} pages rewritten`);
