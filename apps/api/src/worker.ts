// Cloudflare Worker entry point. Wires the real dependencies (D1, clock, crypto) into the pure handler.
import { SHIPPING, lookupProduct } from "@platform/commerce";
import { createHandler } from "./handler.ts";
import { d1Repository } from "./repository.ts";
import type { D1Like } from "./repository.ts";

interface Env {
  /** D1 database binding (see wrangler.toml). */
  DB: D1Like;
  /** Comma-separated exact origins, e.g. "https://vicuna-eg.com,https://staging.vicuna-eg.com". */
  ALLOWED_ORIGINS: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const handler = createHandler({
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository: d1Repository(env.DB),
      allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
      now: () => new Date(),
      randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
      // Error name only. Never log request bodies: they contain customers' personal details.
      // eslint-disable-next-line no-console
      reportError: (name) => console.error("order_insert_failed", name),
    });
    return handler(request);
  },
};
