// Scheduled jobs: the daily backup holds every table and goes to the owner's Telegram chat as a file; the hourly
// watch reports only failures; the cron strings match wrangler.toml.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ALERT_EVERY_MS, BACKUP_TABLES, RECOVERED_MESSAGE, WATCH_STATE_KEY, alertMessage, backupFileName, backupJson, backupKey, failedChecks, telegramDocumentSender, watch } from "../src/scheduled.ts";
import type { BucketLike } from "../src/scheduled.ts";
import worker, { DAILY_BACKUP_CRON, HOURLY_WATCH_CRON } from "../src/worker.ts";
import type { D1Like } from "../src/repository.ts";

const fakeDb = (rows: Record<string, unknown[]>): D1Like =>
  ({
    prepare: (sql: string) => {
      const table = /FROM (\w+)/.exec(sql)![1]!;
      const st = { bind: () => st, all: async () => ({ results: rows[table] ?? [], success: true }), first: async () => null, run: async () => ({ results: [], success: true }) };
      return st;
    },
    batch: async () => [],
  }) as unknown as D1Like;

describe("daily backup", () => {
  it("holds every table, with a dated file name", async () => {
    const now = new Date("2026-10-18T01:00:00Z");
    const json = JSON.parse(await backupJson(fakeDb({ orders: [{ id: "V-1" }], inventory: [{ product_id: "lace-white", quantity: 3 }] }), now));
    assert.equal(json.kind, "vicuna-db-backup");
    assert.equal(json.createdAt, "2026-10-18T01:00:00.000Z");
    assert.deepEqual(Object.keys(json.tables), [...BACKUP_TABLES]);
    assert.deepEqual(json.tables.orders, [{ id: "V-1" }]);
    assert.deepEqual(json.tables.promo_codes, []);
    assert.equal(backupFileName(now), "vicuna-backup-2026-10-18.json");
  });

  it("is sent as a document to the chat; errors never carry the token", async () => {
    let seen: { url: string; form: FormData } | null = null;
    const ok = ((url: string, init: RequestInit) => ((seen = { url, form: init.body as FormData }), Promise.resolve(new Response("{}")))) as unknown as typeof fetch;
    await telegramDocumentSender("tok-9", "123", ok)("b.json", "{}", "caption");
    assert.match(seen!.url, /\/bottok-9\/sendDocument$/);
    assert.equal(seen!.form.get("chat_id"), "123");
    assert.ok(seen!.form.get("document") instanceof Blob);
    const bad = (() => Promise.resolve(new Response("no", { status: 400 }))) as unknown as typeof fetch;
    await assert.rejects(telegramDocumentSender("tok-9", "1", bad)("b.json", "{}", "c"), (e: Error) => e.message === "telegram_http_400");
  });
});

describe("hourly watch", () => {
  const checks = [{ name: "a", url: "https://x/a" }, { name: "b", url: "https://x/b" }, { name: "c", url: "https://x/c" }];
  it("lists only failures: an error status or no answer", async () => {
    const f = ((url: string) => (url.endsWith("/a") ? Promise.resolve(new Response("ok")) : url.endsWith("/b") ? Promise.resolve(new Response("x", { status: 503 })) : Promise.reject(new Error("down")))) as unknown as typeof fetch;
    assert.deepEqual(await failedChecks(checks, f), ["b (503)", "c (لا يرد)"]);
    const all = (() => Promise.resolve(new Response("ok"))) as unknown as typeof fetch;
    assert.deepEqual(await failedChecks(checks, all), []);
    assert.match(alertMessage(["b (503)"]), /الموقع فيه مشكلة[\s\S]*- b \(503\)/);
  });
});

const memoryBucket = () => {
  const files = new Map<string, string>();
  const bucket: BucketLike = {
    put: async (k, v) => void files.set(k, v),
    get: async (k) => (files.has(k) ? { text: async () => files.get(k)! } : null),
    delete: async (k) => void files.delete(k),
  };
  return { bucket, files };
};

describe("site watch messages", () => {
  it("alerts once, then at most every 24 hours, and says when the site is back", async () => {
    const { bucket, files } = memoryBucket();
    const sent: string[] = [];
    const send = async (t: string) => void sent.push(t);
    const t0 = new Date("2026-10-18T10:00:00Z");
    const at = (ms: number) => new Date(t0.getTime() + ms);
    assert.equal(await watch([], bucket, send, t0), "quiet");
    assert.equal(await watch(["a (503)"], bucket, send, t0), "alert");
    assert.ok(files.has(WATCH_STATE_KEY));
    assert.equal(await watch(["a (503)"], bucket, send, at(3600_000)), "quiet");
    assert.equal(await watch(["a (503)"], bucket, send, at(ALERT_EVERY_MS - 1)), "quiet");
    assert.equal(await watch(["a (503)"], bucket, send, at(ALERT_EVERY_MS)), "alert");
    assert.equal(await watch([], bucket, send, at(ALERT_EVERY_MS + 3600_000)), "recovered");
    assert.equal(await watch([], bucket, send, at(ALERT_EVERY_MS + 7200_000)), "quiet");
    assert.equal(sent.length, 3);
    assert.equal(sent[2], RECOVERED_MESSAGE);
    assert.ok(!files.has(WATCH_STATE_KEY));
  });

  it("keeps each day's backup under its own name", () => {
    assert.equal(backupKey(new Date("2026-10-18T01:00:00Z")), "backups/vicuna-backup-2026-10-18.json");
  });

  it("the daily job stores the backup in the bucket even without Telegram", async () => {
    const { bucket, files } = memoryBucket();
    await worker.scheduled({ cron: DAILY_BACKUP_CRON, scheduledTime: Date.parse("2026-10-18T01:00:00Z") }, { DB: fakeDb({ orders: [{ id: "V-1" }] }), BACKUPS: bucket });
    assert.match(files.get("backups/vicuna-backup-2026-10-18.json")!, /"V-1"/);
  });
});

describe("cron triggers", () => {
  it("match wrangler.toml", () => {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    assert.match(toml, new RegExp(`crons = \\["${DAILY_BACKUP_CRON.replace(/\*/g, "\\*")}", "${HOURLY_WATCH_CRON.replace(/\*/g, "\\*")}"\\]`));
  });

  it("do nothing without Telegram settings", async () => {
    await worker.scheduled({ cron: DAILY_BACKUP_CRON, scheduledTime: Date.now() }, { DB: fakeDb({}) });
  });
});
