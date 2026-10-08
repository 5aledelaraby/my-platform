import { site } from "../site.ts";

const production = (import.meta.env.DEPLOY_ENV ?? "production") === "production";

export function GET(): Response {
  const body = production
    ? `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
