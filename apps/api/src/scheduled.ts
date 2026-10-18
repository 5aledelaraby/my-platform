// Scheduled jobs (Cron Triggers in wrangler.toml), owner-approved on 2026-10-17:
//   - every day: a backup of the live database (orders, their items, stock, promo codes) as one JSON file, kept in
//     the private R2 bucket `vicuna-backups` and sent to the owner's own Telegram chat, so a copy always exists
//     outside Cloudflare too. The owner's chat already receives every order's details (privacy policy, "Telegram").
//   - every hour: the public site and the API are checked. When something fails the owner gets one Telegram
//     message, then at most one a day while it lasts (owner, 2026-10-17: "every 24 hours"), and one when it is back.
//     The time of the last alert is kept in the bucket (WATCH_STATE_KEY). Nothing is sent while all is well.
// Errors carry only a short label; the Telegram token is used inside telegram calls only and never logged.
import type { D1Like } from "./repository.ts";

/** The slice of an R2 bucket binding these jobs use. */
export interface BucketLike {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  delete(key: string): Promise<void>;
}

/** Where a day's backup is kept in the bucket. */
export const backupKey = (now: Date): string => `backups/${backupFileName(now)}`;
/** The time of the last "site has a problem" message, while the problem lasts. */
export const WATCH_STATE_KEY = "watch/last-alert.json";
/** At most one alert a day while a problem lasts. */
export const ALERT_EVERY_MS = 24 * 60 * 60 * 1000;

/** The tables a backup holds, in restore order. */
export const BACKUP_TABLES = ["orders", "order_items", "inventory", "promo_codes", "settings"] as const;

/** Every row of every backup table, as one JSON document. */
export async function backupJson(db: D1Like, now: Date): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await db.prepare(`SELECT * FROM ${table}`).all();
    tables[table] = rows.results ?? [];
  }
  return JSON.stringify({ kind: "vicuna-db-backup", version: 1, createdAt: now.toISOString(), tables });
}

/** "vicuna-backup-2026-10-17.json" */
export const backupFileName = (now: Date): string => `vicuna-backup-${now.toISOString().slice(0, 10)}.json`;

/** Sends one file to the owner's Telegram chat (Bot API sendDocument). */
export function telegramDocumentSender(token: string, chatId: string, fetchImpl: typeof fetch = fetch) {
  return async (fileName: string, content: string, caption: string): Promise<void> => {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("document", new Blob([content], { type: "application/json" }), fileName);
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`telegram_http_${res.status}`);
  };
}

/** One check of the hourly site watch: a public address and what a healthy answer looks like. */
export interface SiteCheck {
  name: string;
  url: string;
}

export const SITE_CHECKS: readonly SiteCheck[] = [
  { name: "الصفحة الرئيسية", url: "https://vicuna-eg.com/" },
  { name: "صفحة أحزمة الخصر", url: "https://vicuna-eg.com/collections/vicuna-belts/" },
  { name: "الـ API وقاعدة البيانات", url: "https://vicuna-eg.com/api/health" },
];

/** The names of the checks that failed (an error, a timeout or any answer other than 200). */
export async function failedChecks(checks: readonly SiteCheck[], fetchImpl: typeof fetch = fetch, timeoutMs = 15000): Promise<string[]> {
  const results = await Promise.all(
    checks.map(async (c) => {
      try {
        const res = await fetchImpl(c.url, { headers: { "User-Agent": "vicuna-site-watch" }, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
        return res.status === 200 ? null : `${c.name} (${res.status})`;
      } catch {
        return `${c.name} (لا يرد)`;
      }
    }),
  );
  return results.filter((r): r is string => r !== null);
}

/** The owner's alert while the site has a problem. */
export const alertMessage = (failed: readonly string[]): string =>
  ["⚠️ الموقع فيه مشكلة دلوقتي", "", ...failed.map((f) => `- ${f}`), "", "بنفحص كل ساعة. لو المشكلة فضلت، هتوصلك رسالة تانية بعد 24 ساعة، ورسالة أول ما الموقع يرجع."].join("\n");

export const RECOVERED_MESSAGE = "✅ الموقع رجع يشتغل تمام.";

/**
 * Decides what the hourly watch says: an alert when a problem starts or has lasted 24 hours since the last alert,
 * a recovery message when it ends, and nothing otherwise. Keeps the last alert's time in the bucket.
 */
export async function watch(failed: readonly string[], bucket: BucketLike, send: (text: string) => Promise<void>, now: Date): Promise<"alert" | "recovered" | "quiet"> {
  const stored = await bucket.get(WATCH_STATE_KEY);
  const last = stored ? Number((JSON.parse(await stored.text()) as { at?: unknown }).at) : null;
  if (failed.length === 0) {
    if (last === null) return "quiet";
    await send(RECOVERED_MESSAGE);
    await bucket.delete(WATCH_STATE_KEY);
    return "recovered";
  }
  if (last !== null && Number.isFinite(last) && now.getTime() - last < ALERT_EVERY_MS) return "quiet";
  await send(alertMessage(failed));
  await bucket.put(WATCH_STATE_KEY, JSON.stringify({ at: now.getTime() }), { httpMetadata: { contentType: "application/json" } });
  return "alert";
}
