import assert from "node:assert/strict";
import { describe, it } from "node:test";
import worker from "../src/worker.ts";
import { STAGING_TAG } from "../src/notify.ts";
import type { D1Like, D1Statement } from "../src/index.ts";

const db: D1Like = {
  prepare() {
    const stmt: D1Statement = {
      bind: () => stmt,
      all: () => Promise.resolve({ results: [] }),
      first: () => Promise.resolve(null),
      run: () => Promise.resolve({ meta: { changes: 0 } }),
    };
    return stmt;
  },
  batch: () => Promise.resolve([]),
};

const order = (origin: string) =>
  new Request("https://staging.vicuna-eg.com/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      items: [{ id: "lace-white", quantity: 1 }],
      customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" },
    }),
  });

describe("worker entry", () => {
  it("accepts an order from a configured origin", async () => {
    const env = { DB: db, ALLOWED_ORIGINS: "https://vicuna-eg.com, https://staging.vicuna-eg.com" };
    const res = await worker.fetch(order("https://staging.vicuna-eg.com"), env);
    assert.equal(res.status, 201);
  });

  it("fails closed with a JSON 403 (not a crash) when ALLOWED_ORIGINS is missing", async () => {
    const env = { DB: db } as unknown as Parameters<typeof worker.fetch>[1];
    const res = await worker.fetch(order("https://vicuna-eg.com"), env);
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: "forbidden_origin" });
  });

  it("still answers /health when ALLOWED_ORIGINS is missing", async () => {
    const env = { DB: db } as unknown as Parameters<typeof worker.fetch>[1];
    const res = await worker.fetch(new Request("https://staging.vicuna-eg.com/api/health"), env);
    assert.equal(res.status, 200);
  });

  it("staging uses its own database; the live site and admin keep the live one", async () => {
    const used: string[] = [];
    const tracked = (name: string): D1Like => ({ ...db, batch: (statements) => { used.push(name); return db.batch(statements); } });
    const env = { DB: tracked("live"), DB_STAGING: tracked("staging"), STAGING_HOST: "staging.vicuna-eg.com", ALLOWED_ORIGINS: "https://vicuna-eg.com,https://staging.vicuna-eg.com" };
    assert.equal((await worker.fetch(order("https://staging.vicuna-eg.com"), env)).status, 201);
    const live = new Request(order("https://vicuna-eg.com").url.replace("staging.", ""), order("https://vicuna-eg.com"));
    assert.equal((await worker.fetch(live, env)).status, 201);
    assert.deepEqual(used, ["staging", "live"]);
  });

  it("a staging request without the staging database is refused, never sent to the live one", async () => {
    let touched = false;
    const live: D1Like = { ...db, batch: (statements) => { touched = true; return db.batch(statements); } };
    const env = { DB: live, STAGING_HOST: "staging.vicuna-eg.com", ALLOWED_ORIGINS: "https://staging.vicuna-eg.com" };
    const res = await worker.fetch(order("https://staging.vicuna-eg.com"), env);
    assert.equal(res.status, 503);
    assert.equal(touched, false);
  });

  it("Telegram marks staging orders as tests, and only those", async () => {
    const texts: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      texts.push(JSON.parse(init?.body ?? "{}").text);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const env = { DB: db, DB_STAGING: db, STAGING_HOST: "staging.vicuna-eg.com", TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1", ALLOWED_ORIGINS: "https://vicuna-eg.com,https://staging.vicuna-eg.com" };
      const pending: Promise<unknown>[] = [];
      const ctx = { waitUntil: (w: Promise<unknown>) => { pending.push(w); } };
      await worker.fetch(order("https://staging.vicuna-eg.com"), env, ctx);
      const live = new Request(order("https://vicuna-eg.com").url.replace("staging.", ""), order("https://vicuna-eg.com"));
      await worker.fetch(live, env, ctx);
      await Promise.all(pending);
      assert.equal(texts.length, 2);
      assert.ok(texts[0]!.startsWith(STAGING_TAG));
      assert.ok(!texts[1]!.includes(STAGING_TAG));
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

