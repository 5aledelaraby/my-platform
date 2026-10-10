// Post-build SEO and quality checks on apps/website/dist. Fails the build on any violation.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDeployEnvironment, robotsDirective } from "@platform/seo";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SITE = "https://vicuna-eg.com";
// Sections that are planned (ADR 0009) but not built yet. Links into them are allowed until they exist.
const PLANNED_PREFIXES = [];
const JS_BUDGET_BYTES = 90 * 1024;
// Pages that must stay out of search results and the sitemap even in production.
const NOINDEX_PAGES = new Set(["/thanks/", "/en/thanks/", "/404.html"]);

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
let env;
try {
  env = parseDeployEnvironment(process.env.DEPLOY_ENV);
} catch (error) {
  console.error(`check-dist: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const production = env === "production";

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
  else if (url !== "/404.html" && canonical !== SITE + url) fail(name, `canonical ${canonical} should be ${SITE + url}`);

  const robots = /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];
  if (!robots) fail(name, "missing robots meta");
  else if (NOINDEX_PAGES.has(url)) {
    if (robots !== "noindex,nofollow") fail(name, "thank-you page must be noindex,nofollow");
  } else if (robots !== robotsDirective(env)) fail(name, `${env} page must be ${robotsDirective(env)}, got ${robots}`);

  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) fail(name, `expected exactly one <h1>, found ${h1s}`);

  if (!/<link rel="alternate" hreflang="x-default"/.test(html)) fail(name, "missing hreflang x-default");

  // Markdown article bodies cannot carry width/height; their images are square and sized by CSS (aspect-ratio).
  const prose = /<div class="prose">[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  for (const m of html.replace(prose, "").matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) fail(name, "image without alt attribute");
    if (!/\bwidth=/.test(m[0]) || !/\bheight=/.test(m[0])) fail(name, "image without width/height (layout shift)");
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

  if (url.startsWith("/collections/") || url.startsWith("/en/collections/")) {
    const other = url.startsWith("/en/") ? url.replace("/en", "") : "/en" + url;
    if (!known.has(other)) fail(name, `no counterpart page ${other} for hreflang`);
  }

  // ADR 0009: the homepage introduces the brand, it is not the store.
  if (url === "/" || url === "/en/") {
    if (/data-product|class="product-card|add-to-cart/i.test(html)) fail(name, "homepage must not contain a product grid or cart UI (ADR 0009)");
  }
}

for (const f of ["sitemap.xml", "robots.txt"]) {
  if (!existsSync(join(DIST, f))) fail(f, "missing from build output");
}
if (existsSync(join(DIST, "robots.txt"))) {
  const txt = readFileSync(join(DIST, "robots.txt"), "utf8");
  const blocksAll = /^Disallow: \/\s*$/m.test(txt);
  if (production && (blocksAll || !txt.includes(`Sitemap: ${SITE}/sitemap.xml`))) fail("robots.txt", "production must allow crawling and list the sitemap");
  if (!production && !blocksAll) fail("robots.txt", `${env} must block all crawling (Disallow: /)`);
}

// Legacy URLs (old site) -> new URLs. Every target must be a page of this build (no redirect into a 404).
if (existsSync(join(DIST, "_redirects"))) {
  const rules = readFileSync(join(DIST, "_redirects"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const sources = new Set();
  for (const rule of rules) {
    const [from, to, code, extra] = rule.split(/\s+/);
    if (!from?.startsWith("/") || !to?.startsWith("/") || code !== "301" || extra !== undefined) fail("_redirects", `malformed rule: ${rule}`);
    else if (from.includes("*") || from.includes(":")) fail("_redirects", `use explicit rules only: ${rule}`);
    else if (sources.has(from)) fail("_redirects", `duplicate source ${from}`);
    else if (known.has(from)) fail("_redirects", `redirects away from a live page ${from}`);
    else if (!known.has(to)) fail("_redirects", `target is not a page of this build: ${rule}`);
    sources.add(from);
  }
}

if (production && existsSync(join(DIST, "sitemap.xml"))) {
  const sm = readFileSync(join(DIST, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) if (NOINDEX_PAGES.has(loc.replace(SITE, "")) || !known.has(loc.replace(SITE, ""))) fail("sitemap.xml", `lists a page that does not exist: ${loc}`);
  for (const u of known) if (!NOINDEX_PAGES.has(u) && !locs.includes(SITE + u)) fail("sitemap.xml", `missing page ${u}`);
}

const jsBytes = files.filter((f) => f.endsWith(".js")).reduce((n, f) => n + statSync(f).size, 0);
if (jsBytes > JS_BUDGET_BYTES) fail("dist", `JavaScript ${jsBytes} bytes exceeds budget ${JS_BUDGET_BYTES}`);

if (errors.length) {
  console.error(`check-dist failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-dist ok (DEPLOY_ENV=${env}): ${pages.length} pages, JS ${jsBytes} bytes.`);
