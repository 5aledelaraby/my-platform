// Local inventory feed for Google Merchant Center (pickup at Vicuna). See lib/feed.ts.
import { buildLocalInventoryCsv } from "../../lib/feed.ts";

export function GET(): Response {
  return new Response(buildLocalInventoryCsv(), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
