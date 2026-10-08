import { buildSitemapXml } from "@platform/seo";
import { beltsUrl, products, styles } from "../store.ts";
import { articleUrl, articles } from "../lib/articles.ts";
import { langPath, site } from "../site.ts";

export function GET(): Response {
  const paths = [
    ...(["ar", "en"] as const).flatMap((lang) => [
      langPath(lang, "/"),
      beltsUrl(lang),
      ...styles.map((s) => beltsUrl(lang, s.id)),
      ...products.map((p) => beltsUrl(lang, p.id)),
    ]),
    "/blog/",
    ...articles.map((a) => articleUrl(a.slug)),
  ];
  const lastmod = new Map(articles.map((a) => [articleUrl(a.slug), a.dateModified ?? a.datePublished]));
  return new Response(buildSitemapXml(paths.map((p) => ({ loc: `${site.url}${p}`, ...(lastmod.has(p) ? { lastmod: lastmod.get(p) } : {}) }))), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
