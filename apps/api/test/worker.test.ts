import assert from "node:assert/strict";
import { describe, it } from "node:test";
import worker from "../src/worker.ts";
import type { D1Like } from "../src/index.ts";

const db: D1Like = {
  prepare() {
    const stmt = { bind: () => stmt };
    return stmt;
  },
  batch: () => Promise.resolve([]),
};

const order = (origin: string) =>
  new Request("https://staging.vicuna-eg.com/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      items: [{ id: "lace-black", quantity: 1 }],
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
});
