// Post-build SEO and quality checks on apps/website/dist. Fails the build on any violation.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SITE = "https://vicuna-eg.com";
// Sections that are planned (ADR 0009) but not built yet. Links into them are allowed until they exist.
const PLANNED_PREFIXES = ["/belts/", "/en/belts/"];
const JS_BUDGET_BYTES = 60 * 1024;

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(DIST)) {
  console.error("dist/ not found. Run astro build first.");
  process.exit(1);
}

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith(".html"));
const urlOf = (file) => "/" + relative(DIST, file).replace(/index\.html$/, "");
const known = new Set(pages.map(urlOf));
const production = (process.env.DEPLOY_ENV ?? "production") === "production";

for (const file of pages) {
  const url = urlOf(file);
  const html = readFileSync(file, "utf8");
  const name = url;

  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim();
  if (!title) fail(name, "missing <title>");
  else if (title.length > 70) fail(name, `title too long (${title.length})`);

  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1]?.trim();
  if (!desc) fail(name, "missing meta description");
  else if (desc.length > 200) fail(name, `description too long (${desc.length})`);

  const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];
  if (!canonical) fail(name, "missing canonical");
  else if (canonical !== SITE + url) fail(name, `canonical ${canonical} should be ${SITE + url}`);

  const robots = /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];
  if (!robots) fail(name, "missing robots meta");
  else if (production && robots !== "index,follow") fail(name, `production page must be index,follow, got ${robots}`);
  else if (!production && robots !== "noindex,nofollow") fail(name, "non-production page must be noindex,nofollow");

  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) fail(name, `expected exactly one <h1>, found ${h1s}`);

  if (!/<link rel="alternate" hreflang="x-default"/.test(html)) fail(name, "missing hreflang x-default");

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) fail(name, "image without alt attribute");
  }

  for (const m of html.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)"/g)) {
    const href = m[1];
    const isAsset = /\.[a-z0-9]+$/i.test(href);
    if (isAsset) {
      if (!existsSync(join(DIST, href))) fail(name, `broken asset link ${href}`);
    } else if (!known.has(href) && !PLANNED_PREFIXES.some((p) => href.startsWith(p))) {
      fail(name, `broken internal link ${href}`);
    }
  }

  // ADR 0009: the homepage introduces the brand, it is not the store.
  if (url === "/" || url === "/en/") {
    if (/data-product|class="product-card|add-to-cart/i.test(html)) fail(name, "homepage must not contain a product grid or cart UI (ADR 0009)");
  }
}

const jsBytes = files.filter((f) => f.endsWith(".js")).reduce((n, f) => n + statSync(f).size, 0);
if (jsBytes > JS_BUDGET_BYTES) fail("dist", `JavaScript ${jsBytes} bytes exceeds budget ${JS_BUDGET_BYTES}`);

if (errors.length) {
  console.error(`check-dist failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-dist ok: ${pages.length} pages, JS ${jsBytes} bytes.`);
