import { buildSitemapXml } from "@platform/seo";
import { beltsUrl, products, styles } from "../store.ts";
import { articleUrl, articles } from "../lib/articles.ts";
import { JOURNAL_PATH, langPath, site } from "../site.ts";
import { POLICY_IDS, policyPath } from "../policies/index.ts";

export function GET(): Response {
  const paths = [
    ...(["ar", "en"] as const).flatMap((lang) => [
      langPath(lang, "/"),
      beltsUrl(lang),
      ...styles.map((s) => beltsUrl(lang, s.id)),
      ...products.map((p) => beltsUrl(lang, p.id)),
      ...POLICY_IDS.map((id) => policyPath(lang, id)),
      langPath(lang, "/contact/"),
    ]),
    JOURNAL_PATH,
    ...articles.map((a) => articleUrl(a.slug)),
  ];
  const lastmod = new Map<string, string>([
    ...articles.map((a) => [articleUrl(a.slug), a.dateModified ?? a.datePublished] as [string, string]),
    ...(["ar", "en"] as const).flatMap((lang) => POLICY_IDS.map((id) => [policyPath(lang, id), site.policiesUpdated] as [string, string])),
  ]);
  const entries = paths.map((p) => {
    const date = lastmod.get(p);
    return date ? { loc: `${site.url}${p}`, lastmod: date } : { loc: `${site.url}${p}` };
  });
  return new Response(buildSitemapXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
