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
const NOINDEX_PAGES = new Set(["/thanks/", "/ar/thanks/", "/favorites/", "/ar/favorites/", "/404.html"]);

const errors = [];
/** Pages and the hreflang alternates they declare, checked both ways after every page is read. */
const alternateMap = new Map();
/** Every page that some other page links to (orphan check). */
const linkedTo = new Set();
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const ARABIC = /[\u0600-\u06FF]/;
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/**
 * Arabic words on an English page outside an element marked lang="ar" (AGENTS.md: English pages carry no Arabic text,
 * except the language button and the journal's Arabic section, which are marked lang="ar"). Reads the visible text and
 * the alt, aria-label, title and placeholder attributes; scripts and styles are skipped.
 */
function arabicOnEnglishPage(html) {
  const found = [];
  const stack = [];
  const inArabic = () => stack.some((e) => e.ar);
  const body = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g)) {
    const [, close, tag, attrs, text] = m;
    if (text !== undefined) {
      if (ARABIC.test(text) && !inArabic()) found.push(text.trim().slice(0, 60));
      continue;
    }
    const name = tag.toLowerCase();
    if (close) {
      const i = stack.map((e) => e.tag).lastIndexOf(name);
      if (i >= 0) stack.length = i;
      continue;
    }
    const ar = /\slang="ar"/.test(attrs);
    for (const a of attrs.matchAll(/\s(alt|aria-label|title|placeholder)="([^"]*)"/g)) {
      if (ARABIC.test(a[2]) && !ar && !inArabic()) found.push(`${a[1]}="${a[2].slice(0, 60)}"`);
    }
    if (!VOID_TAGS.has(name) && !attrs.trimEnd().endsWith("/")) stack.push({ tag: name, ar });
  }
  return found;
}

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

  if (!/<html[^>]*\slang="ar"/.test(html)) {
    for (const text of arabicOnEnglishPage(html)) fail(name, `Arabic text on an English page outside lang="ar": ${text}`);
  }

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
    if (robots !== "noindex,nofollow") fail(name, "thank-you and favourites pages must be noindex,nofollow");
  } else if (robots !== robotsDirective(env)) fail(name, `${env} page must be ${robotsDirective(env)}, got ${robots}`);

  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) fail(name, `expected exactly one <h1>, found ${h1s}`);

  // hreflang (journal guides with a translation, and the store pages that exist in English and Arabic): every alternate is a page of this build, the page lists
  // itself, and the other page lists it back (Google ignores one-sided pairs).
  const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] }));
  if (alternates.length) {
    alternateMap.set(url, alternates);
    if (!alternates.some((a) => a.href === SITE + url)) fail(name, "hreflang alternates must include the page itself");
    if (!alternates.some((a) => a.lang === "x-default")) fail(name, "hreflang alternates need an x-default");
    for (const a of alternates) if (!known.has(a.href.replace(SITE, ""))) fail(name, `hreflang points at a missing page ${a.href}`);
  }

  // Markdown article bodies cannot carry width/height; their images are square and sized by CSS (aspect-ratio).
  const prose = /<div class="prose">[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  for (const m of html.replace(prose, "").matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) fail(name, "image without alt attribute");
    if (!/\bwidth=/.test(m[0]) || !/\bheight=/.test(m[0])) fail(name, "image without width/height (layout shift)");
  }

  for (const m of html.matchAll(/<img\b[^>]*\ssrc="(\/[^"]+)"/g)) {
    if (!m[1].startsWith("/v/") && !existsSync(join(DIST, m[1]))) fail(name, `missing image ${m[1]}`);
  }

  for (const m of html.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (href !== url) linkedTo.add(href);
    const isAsset = /\.[a-z0-9]+$/i.test(href);
    if (isAsset) {
      if (!existsSync(join(DIST, href))) fail(name, `broken asset link ${href}`);
    } else if (!known.has(href) && !PLANNED_PREFIXES.some((p) => href.startsWith(p))) {
      fail(name, `broken internal link ${href}`);
    }
  }

  if (url.startsWith("/en/")) fail(name, "English pages live at the root since 2026-10-19; /en/ only redirects");
}

for (const [url, alternates] of alternateMap) {
  for (const a of alternates) {
    const other = a.href.replace(SITE, "");
    if (other === url || a.lang === "x-default") continue;
    if (!(alternateMap.get(other) ?? []).some((b) => b.href === SITE + url)) fail(url, `hreflang pair is one-sided: ${other} does not point back`);
  }
}

// Orphans: a page nothing links to is hard for visitors and Google to find. Every indexable page needs a link from
// at least one other page (menus, footer, belts pages, guides).
for (const u of known) {
  if (u !== "/" && !NOINDEX_PAGES.has(u) && !linkedTo.has(u)) fail(u, "no page links here (orphan page): link it from a menu, the footer or a related page");
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

// Every versioned asset a page links to (scripts/fingerprint.mjs) must be in the build.
for (const file of pages) {
  for (const m of readFileSync(file, "utf8").matchAll(/\/v\/[0-9a-f]+\/(?:img|video|brand|fonts)\/[A-Za-z0-9._/-]+/g)) {
    if (!existsSync(join(DIST, m[0]))) fail(urlOf(file), `missing versioned asset ${m[0]}`);
  }
}

if (errors.length) {
  console.error(`check-dist failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-dist ok (DEPLOY_ENV=${env}): ${pages.length} pages, JS ${jsBytes} bytes.`);
