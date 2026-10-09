// Cloudflare Worker entry point. Wires the real dependencies (D1, clock, crypto) into the pure handler.
import { SHIPPING, lookupProduct } from "@platform/commerce";
import { accessVerifier } from "./access.ts";
import { createAdminHandler } from "./admin.ts";
import { createHandler } from "./handler.ts";
import { telegramNotifier } from "./notify.ts";
import { d1Repository } from "./repository.ts";
import type { D1Like } from "./repository.ts";

interface Env {
  /** D1 database binding (see wrangler.toml). */
  DB: D1Like;
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
}

/** The slice of the Workers ExecutionContext this app uses. */
interface Ctx {
  waitUntil(work: Promise<unknown>): void;
}

export default {
  fetch(request: Request, env: Env, ctx?: Ctx): Promise<Response> {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    const repository = d1Repository(env.DB);
    const now = () => new Date();
    const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
    // eslint-disable-next-line no-console
    const reportError = (name: string) => console.error("order_error", name);
    const emails = (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const accessReady = Boolean(env.ACCESS_TEAM_DOMAIN?.trim() && env.ACCESS_AUD?.trim() && emails.length > 0);
    const admin = createAdminHandler({
      repository,
      verify: accessReady ? accessVerifier({ teamDomain: env.ACCESS_TEAM_DOMAIN ?? "", audience: env.ACCESS_AUD ?? "", emails }) : null,
      now,
      randomBytes,
      reportError,
    });
    const handler = createHandler({
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository,
      admin,
      ...(env.ADMIN_HOST?.trim() ? { adminHost: env.ADMIN_HOST.trim().toLowerCase() } : {}),
      // A missing variable means "no browser origin is allowed" (fail closed), not a crash.
      allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
      now,
      randomBytes,
      // Error label only. Never log request bodies: they contain customers' personal details.
      reportError,
      // Notifications are on only when both values are set in the dashboard.
      ...(token && chatId ? { notify: telegramNotifier(token, chatId) } : {}),
      ...(ctx ? { waitUntil: (work: Promise<unknown>) => ctx.waitUntil(work) } : {}),
    });
    return handler(request);
  },
};
