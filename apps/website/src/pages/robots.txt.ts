import { deployEnvironment } from "../deploy-env.ts";
import { site } from "../site.ts";

export function GET(): Response {
  const production = deployEnvironment() === "production";
  const body = production
    ? `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
