// Product feed for Meta Commerce Manager and Google Merchant Center (both fetch this URL). See lib/feed.ts.
import { buildFeedCsv } from "../../lib/feed.ts";
import { beltsUrl, lookOf } from "../../store.ts";
import { site } from "../../site.ts";

export function GET(): Response {
  const csv = buildFeedCsv({
    siteUrl: site.url,
    brand: site.nameEn,
    productUrl: (p) => `${site.url}${beltsUrl("ar", p.id)}`,
    hasLook: (p) => lookOf(p) !== null,
  });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
