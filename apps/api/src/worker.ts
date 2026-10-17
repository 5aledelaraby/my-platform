// Cloudflare Worker entry point. Wires the real dependencies (D1, clock, crypto) into the pure handler.
import { SHIPPING, lookupProduct } from "@platform/commerce";
import { accessVerifier } from "./access.ts";
import { createAdminHandler } from "./admin.ts";
import { createHandler } from "./handler.ts";
import { metaPurchaseReporter } from "./meta.ts";
import { SITE_CHECKS, alertMessage, backupFileName, backupJson, failedChecks, telegramDocumentSender } from "./scheduled.ts";
import { STAGING_TAG, formatOrderMessage, formatStatusMessage, tagged, telegramSender } from "./notify.ts";
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
  /** Meta dataset (Pixel) id for the Conversions API (wrangler.toml [vars]; public, the same id the site's Pixel uses). */
  META_PIXEL_ID?: string;
  /** Secret (dashboard): the Conversions API access token from Events Manager. Without it nothing is sent to Meta. */
  META_TOKEN?: string;
  /** Optional (dashboard): Events Manager test code. Orders on staging go to Meta only with it, as test events. */
  META_TEST_EVENT_CODE?: string;
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

/** Cron schedules (wrangler.toml [triggers]); scheduled.ts has the jobs. */
export const DAILY_BACKUP_CRON = "0 1 * * *";
export const HOURLY_WATCH_CRON = "0 * * * *";

export default {
  /** Cron Triggers: the daily backup and the hourly site watch, both reported to the owner's Telegram chat. */
  async scheduled(event: { cron: string; scheduledTime: number }, env: Env): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    // eslint-disable-next-line no-console
    const report = (name: string) => console.error("scheduled_error", name);
    if (!token || !chatId) return report("telegram_not_configured");
    const now = new Date(event.scheduledTime);
    try {
      if (event.cron === DAILY_BACKUP_CRON) {
        const send = telegramDocumentSender(token, chatId);
        await send(backupFileName(now), await backupJson(env.DB, now), `💾 نسخة احتياطية من قاعدة بيانات فيكونا (${now.toISOString().slice(0, 10)})`);
      } else if (event.cron === HOURLY_WATCH_CRON) {
        const failed = await failedChecks(SITE_CHECKS);
        if (failed.length > 0) await telegramSender(token, chatId)(alertMessage(failed));
      }
    } catch (error) {
      report(error instanceof Error ? error.message : "unknown");
    }
  },

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
    const live = token && chatId ? telegramSender(token, chatId) : null;
    // Orders placed on staging are marked as tests in Telegram.
    const send = live && onStaging ? tagged(live, STAGING_TAG) : live;
    // Meta Conversions API (meta.ts): live orders count for the ads; staging orders are sent only as test events.
    const pixelId = env.META_PIXEL_ID?.trim();
    const capiToken = env.META_TOKEN?.trim();
    const testCode = env.META_TEST_EVENT_CODE?.trim();
    const reportPurchase = pixelId && capiToken && (!onStaging || testCode) ? metaPurchaseReporter(pixelId, capiToken, onStaging ? testCode : undefined) : null;
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
      ...(reportPurchase ? { reportPurchase } : {}),
      ...waitUntil,
    });
    return handler(request);
  },
};
