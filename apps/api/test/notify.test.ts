import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, lookupProduct } from "@platform/commerce";
import type { Order } from "@platform/commerce";
import { createHandler, formatOrderMessage, memoryRepository, telegramNotifier } from "../src/index.ts";
import type { HandlerDeps, Notifier } from "../src/index.ts";
import worker from "../src/worker.ts";

const order: Order = {
  id: "V-1009-98LGT",
  createdAt: "2026-10-09T05:31:00.000Z",
  status: "new",
  customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد", notes: "الدور *الثالث* <b>" },
  items: [
    { productId: "bow-gold", name: "فيونكة دهبي", unitPrice: 20000, quantity: 2, lineTotal: 40000 },
    { productId: "lace-black", name: "دانتيل أسود", unitPrice: 30000, quantity: 1, lineTotal: 30000 },
  ],
  shippingMethod: "express",
  paymentMethod: "instapay",
  totals: { itemCount: 3, subtotal: 70000, discount: 12000, net: 58000, shipping: 12000, total: 70000 },
};

describe("formatOrderMessage", () => {
  const text = formatOrderMessage(order);

  it("has everything needed to confirm and ship the order", () => {
    for (const part of [
      "طلب جديد V-1009-98LGT",
      "الاسم: منى أحمد",
      "الموبايل: 01012345678",
      "https://wa.me/201012345678",
      "المحافظة: القاهرة",
      "العنوان: مدينة نصر، شارع عباس العقاد",
      "- فيونكة دهبي (bow-gold) × 2 = 400 ج",
      "- دانتيل أسود (lace-black) × 1 = 300 ج",
      "الخصم: -120 ج",
      "الشحن (سريع): 120 ج",
      "الإجمالي: 700 ج",
      "الدفع: InstaPay (تحويل يدوي)",
    ]) {
      assert.ok(text.includes(part), `missing: ${part}\n---\n${text}`);
    }
  });

  it("shows the time in Cairo, not UTC", () => {
    // 05:31 UTC = 08:31 in Cairo (UTC+3 on this date).
    assert.match(text, /8:31/);
  });

  it("keeps customer text verbatim as plain text", () => {
    assert.ok(text.includes("ملاحظات: الدور *الثالث* <b>"));
  });

  it("stays under Telegram's message limit", () => {
    const long = { ...order, customer: { ...order.customer, address: "ع".repeat(5000) } };
    assert.ok(formatOrderMessage(long).length <= 4000);
  });
});

describe("telegramNotifier", () => {
  it("posts one plain-text message to the chat and never puts the token in the error", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const ok: typeof fetch = (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return Promise.resolve(new Response("{}", { status: 200 }));
    };
    await telegramNotifier("123:SECRET", "42", ok)(order);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://api.telegram.org/bot123:SECRET/sendMessage");
    assert.equal(calls[0]?.body["chat_id"], "42");
    assert.equal(calls[0]?.body["parse_mode"], undefined);

    const denied: typeof fetch = () => Promise.resolve(new Response("{}", { status: 401 }));
    await assert.rejects(telegramNotifier("123:SECRET", "42", denied)(order), (e: Error) => {
      assert.equal(e.message, "telegram_http_401");
      assert.ok(!e.message.includes("SECRET"));
      return true;
    });
  });
});

describe("handler + notification", () => {
  const ORIGIN = "https://staging.vicuna-eg.com";
  const request = (items: unknown) =>
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        items,
        customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" },
      }),
    });

  function setup(notify: Notifier) {
    const background: Array<Promise<unknown>> = [];
    const reported: string[] = [];
    const repository = memoryRepository();
    let n = 0;
    const deps: HandlerDeps = {
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository,
      allowedOrigins: [ORIGIN],
      now: () => new Date("2026-10-09T05:31:00Z"),
      randomBytes: (len) => Uint8Array.from({ length: len }, () => n++),
      reportError: (name) => reported.push(name),
      notify,
      waitUntil: (work) => background.push(work),
    };
    return { handler: createHandler(deps), background, reported, repository };
  }

  it("notifies once for a stored order, in the background", async () => {
    const sent: string[] = [];
    const { handler, background, repository } = setup((o) => (sent.push(o.id), Promise.resolve()));
    const res = await handler(request([{ id: "lace-black", quantity: 1 }]));
    assert.equal(res.status, 201);
    await Promise.all(background);
    assert.equal(sent.length, 1);
    assert.equal(sent[0], [...repository.orders.keys()][0]);
  });

  it("a failed notification does not fail the order and is reported without details", async () => {
    const { handler, background, reported, repository } = setup(() => Promise.reject(new Error("telegram_http_500")));
    const res = await handler(request([{ id: "lace-black", quantity: 1 }]));
    assert.equal(res.status, 201);
    await Promise.all(background);
    assert.equal(repository.orders.size, 1);
    assert.deepEqual(reported, ["notify_failed:Error"]);
  });

  it("does not notify for rejected orders", async () => {
    let calls = 0;
    const { handler } = setup(() => (calls++, Promise.resolve()));
    const res = await handler(request([{ id: "fendi-ff", quantity: 1 }]));
    assert.equal(res.status, 422);
    assert.equal(calls, 0);
  });
});

describe("worker wiring", () => {
  const db = {
    prepare() {
      const stmt = { bind: () => stmt };
      return stmt;
    },
    batch: () => Promise.resolve([]),
  };
  const req = () =>
    new Request("https://staging.vicuna-eg.com/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://staging.vicuna-eg.com" },
      body: JSON.stringify({
        items: [{ id: "lace-black", quantity: 1 }],
        customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" },
      }),
    });

  it("sends nothing when the Telegram settings are absent", async () => {
    const work: Array<Promise<unknown>> = [];
    const res = await worker.fetch(req(), { DB: db, ALLOWED_ORIGINS: "https://staging.vicuna-eg.com" }, { waitUntil: (w) => work.push(w) });
    assert.equal(res.status, 201);
    assert.equal(work.length, 0);
  });

  it("hands the notification to waitUntil when both settings are present", async () => {
    const realFetch = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = ((input: string | URL | Request) => (urls.push(String(input)), Promise.resolve(new Response("{}")))) as typeof fetch;
    try {
      const work: Array<Promise<unknown>> = [];
      const env = { DB: db, ALLOWED_ORIGINS: "https://staging.vicuna-eg.com", TELEGRAM_BOT_TOKEN: "1:abc", TELEGRAM_CHAT_ID: "42" };
      const res = await worker.fetch(req(), env, { waitUntil: (w) => work.push(w) });
      assert.equal(res.status, 201);
      assert.equal(work.length, 1);
      await Promise.all(work);
      assert.deepEqual(urls, ["https://api.telegram.org/bot1:abc/sendMessage"]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
