// Cloudflare Worker entry point. Wires the real dependencies (D1, clock, crypto) into the pure handler.
import { SHIPPING, lookupProduct } from "@platform/commerce";
import { accessVerifier } from "./access.ts";
import { createAdminHandler } from "./admin.ts";
import { createHandler } from "./handler.ts";
import { formatOrderMessage, formatStatusMessage, telegramSender } from "./notify.ts";
import { d1Repository } from "./repository.ts";
import type { D1Like } from "./repository.ts";

interface Env {
  /** D1 database binding (see wrangler.toml): live orders and stock. */
  DB: D1Like;
  /** Staging's own database, used for every request on STAGING_HOST. */
  DB_STAGING?: D1Like;
  /** Hostname of the staging site, e.g. "staging.vicuna-eg.com" (wrangler.toml [vars]). */
  STAGING_HOST?: string;
  /** Comma-separated exact origins, e.g. "https://vicuna-eg.com,https://staging.vicuna-eg.com". */
  ALLOWED_ORIGINS?: string;
  /** Secret (Cloudflare dashboard: Settings > Variables and Secrets). Never in git. */
  TELEGRAM_BOT_TOKEN?: string;
  /** The owner's Telegram chat id. Not secret, but set in the dashboard next to the token. */
  TELEGRAM_CHAT_ID?: string;
  /** Cloudflare Access (Zero Trust) for the admin host. Set all three as Secrets in the dashboard. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Comma-separated owner emails allowed into the admin. */
  ADMIN_EMAILS?: string;
  /** Hostname that serves the admin only, e.g. "admin.vicuna-eg.com" (wrangler.toml [vars]). */
  ADMIN_HOST?: string;
  /** Workers Rate Limiting bindings (wrangler.toml [[ratelimits]]): orders and promo-code checks per visitor. */
  ORDER_LIMIT?: RateLimiter;
  PROMO_LIMIT?: RateLimiter;
}

/** The slice of the Workers rate limiting binding this app uses. */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The slice of the Workers ExecutionContext this app uses. */
interface Ctx {
  waitUntil(work: Promise<unknown>): void;
}

export default {
  fetch(request: Request, env: Env, ctx?: Ctx): Promise<Response> {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    // Staging never shares the live database: its requests use DB_STAGING, and without it they are refused.
    const stagingHost = env.STAGING_HOST?.trim().toLowerCase();
    const onStaging = !!stagingHost && new URL(request.url).hostname === stagingHost;
    if (onStaging && !env.DB_STAGING) {
      return Promise.resolve(new Response(JSON.stringify({ error: "staging_database_missing" }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } }));
    }
    const repository = d1Repository(onStaging && env.DB_STAGING ? env.DB_STAGING : env.DB);
    const now = () => new Date();
    const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
    // eslint-disable-next-line no-console
    const reportError = (name: string) => console.error("order_error", name);
    // Telegram is on only when both values are set in the dashboard.
    const send = token && chatId ? telegramSender(token, chatId) : null;
    const waitUntil = ctx ? { waitUntil: (work: Promise<unknown>) => ctx.waitUntil(work) } : {};
    const emails = (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const missingSettings = [
      ...(env.ACCESS_TEAM_DOMAIN?.trim() ? [] : ["ACCESS_TEAM_DOMAIN"]),
      ...(env.ACCESS_AUD?.trim() ? [] : ["ACCESS_AUD"]),
      ...(emails.length > 0 ? [] : ["ADMIN_EMAILS"]),
    ];
    const accessReady = missingSettings.length === 0;
    const admin = createAdminHandler({
      repository,
      verify: accessReady ? accessVerifier({ teamDomain: env.ACCESS_TEAM_DOMAIN ?? "", audience: env.ACCESS_AUD ?? "", emails }) : null,
      missingSettings,
      now,
      randomBytes,
      reportError,
      ...(send ? { notifyStatus: (order, from, to) => send(formatStatusMessage(order, from, to, now())) } : {}),
      ...waitUntil,
    });
    const handler = createHandler({
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository,
      admin,
      ...(env.ADMIN_HOST?.trim() ? { adminHost: env.ADMIN_HOST.trim().toLowerCase() } : {}),
      allow: async (kind, key) => {
        const limiter = kind === "order" ? env.ORDER_LIMIT : env.PROMO_LIMIT;
        return limiter ? (await limiter.limit({ key: `${kind}:${key}` })).success : true;
      },
      // A missing variable means "no browser origin is allowed" (fail closed), not a crash.
      allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
      now,
      randomBytes,
      // Error label only. Never log request bodies: they contain customers' personal details.
      reportError,
      ...(send ? { notify: (order) => send(formatOrderMessage(order)) } : {}),
      ...waitUntil,
    });
    return handler(request);
  },
};
