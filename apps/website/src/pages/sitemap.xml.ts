import { buildSitemapXml } from "@platform/seo";
import { beltsUrl, products, styles } from "../store.ts";
import { langPath, site } from "../site.ts";

export function GET(): Response {
  const paths = [
    ...(["ar", "en"] as const).flatMap((lang) => [
      langPath(lang, "/"),
      beltsUrl(lang),
      ...styles.map((s) => beltsUrl(lang, s.id)),
      ...products.map((p) => beltsUrl(lang, p.id)),
    ]),
  ];
  return new Response(buildSitemapXml(paths.map((p) => ({ loc: `${site.url}${p}` }))), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
