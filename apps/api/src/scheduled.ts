// Scheduled jobs (Cron Triggers in wrangler.toml), owner-approved on 2026-10-17:
//   - every day: a backup of the live database (orders, their items, stock, promo codes) sent to the owner's own
//     Telegram chat as a JSON file, so a copy always exists outside Cloudflare. The owner's chat already receives
//     every order's details (privacy policy, "Telegram"); nothing goes anywhere else.
//   - every hour: the public site and the API are checked; while something fails, the owner gets a Telegram
//     message every hour. Nothing is sent while all is well.
// Errors carry only a short label; the Telegram token is used inside telegram calls only and never logged.
import type { D1Like } from "./repository.ts";

/** The tables a backup holds, in restore order. */
export const BACKUP_TABLES = ["orders", "order_items", "inventory", "promo_codes"] as const;

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
  ["⚠️ الموقع فيه مشكلة دلوقتي", "", ...failed.map((f) => `- ${f}`), "", "هتوصلك رسالة كل ساعة طول ما المشكلة موجودة."].join("\n");
