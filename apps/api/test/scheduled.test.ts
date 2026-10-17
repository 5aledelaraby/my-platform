// Scheduled jobs: the daily backup holds every table and goes to the owner's Telegram chat as a file; the hourly
// watch reports only failures; the cron strings match wrangler.toml.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BACKUP_TABLES, alertMessage, backupFileName, backupJson, failedChecks, telegramDocumentSender } from "../src/scheduled.ts";
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

describe("cron triggers", () => {
  it("match wrangler.toml", () => {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    assert.match(toml, new RegExp(`crons = \\["${DAILY_BACKUP_CRON.replace(/\*/g, "\\*")}", "${HOURLY_WATCH_CRON.replace(/\*/g, "\\*")}"\\]`));
  });

  it("do nothing without Telegram settings", async () => {
    await worker.scheduled({ cron: DAILY_BACKUP_CRON, scheduledTime: Date.now() }, { DB: fakeDb({}) });
  });
});
