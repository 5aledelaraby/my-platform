// Cloudflare Worker entry point. Wires the real dependencies (D1, clock, crypto) into the pure handler.
import { SHIPPING, lookupProduct } from "@platform/commerce";
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
}

/** The slice of the Workers ExecutionContext this app uses. */
interface Ctx {
  waitUntil(work: Promise<unknown>): void;
}

export default {
  fetch(request: Request, env: Env, ctx?: Ctx): Promise<Response> {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    const handler = createHandler({
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository: d1Repository(env.DB),
      // A missing variable means "no browser origin is allowed" (fail closed), not a crash.
      allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
      now: () => new Date(),
      randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
      // Error label only. Never log request bodies: they contain customers' personal details.
      // eslint-disable-next-line no-console
      reportError: (name) => console.error("order_error", name),
      // Notifications are on only when both values are set in the dashboard.
      ...(token && chatId ? { notify: telegramNotifier(token, chatId) } : {}),
      ...(ctx ? { waitUntil: (work: Promise<unknown>) => ctx.waitUntil(work) } : {}),
    });
    return handler(request);
  },
};
