export type DeployEnvironment = "production" | "staging" | "preview";

/**
 * Only production may be indexed. Staging and preview deployments must never compete
 * with the real site (duplicate content), so they always get noindex.
 */
export function robotsDirective(env: DeployEnvironment): "index,follow" | "noindex,nofollow" {
  return env === "production" ? "index,follow" : "noindex,nofollow";
}

/**
 * Canonical URL for a page: site origin + pathname, no query string, no hash,
 * always a leading slash, and a trailing slash for page paths (not for file paths like /sitemap.xml).
 */
export function canonicalUrl(siteUrl: string, pathname: string): string {
  const origin = new URL(siteUrl).origin;
  const path = pathname.split(/[?#]/, 1)[0] ?? "";
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  const lastSegment = withLeading.slice(withLeading.lastIndexOf("/") + 1);
  const isFile = lastSegment.includes(".");
  const normalized = isFile || withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
  return `${origin}${normalized}`;
}

export interface SitemapEntry {
  /** Absolute URL. */
  loc: string;
  /** ISO date (YYYY-MM-DD) or full ISO datetime. */
  lastmod?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemapXml(entries: readonly SitemapEntry[]): string {
  const rows = entries
    .map((e) => {
      const lastmod = e.lastmod ? `<lastmod>${escapeXml(e.lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(e.loc)}</loc>${lastmod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
