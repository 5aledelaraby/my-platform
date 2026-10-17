// Meta Conversions API: the Purchase event matches the browser Pixel's, carries only what the privacy policy lists,
// is sent only with consent, and never fails or slows the order.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { SHIPPING, lookupProduct } from "@platform/commerce";
import type { Order } from "@platform/commerce";
import { cookieValue, createHandler, memoryRepository, metaPhone, metaPurchaseReporter, purchaseEvent } from "../src/index.ts";
import type { BrowserSignal } from "../src/index.ts";

const ORIGIN = "https://vicuna-eg.com";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const order = {
  id: "V-1017-ABCDE",
  createdAt: "2026-10-17T05:00:00.000Z",
  status: "new",
  customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر" },
  items: [
    { productId: "lace-white", name: "دانتيل أبيض", unitPrice: 30000, quantity: 2, lineTotal: 60000 },
    { productId: "pattern-brown", name: "بنقشة مميزة بني", unitPrice: 70000, quantity: 1, lineTotal: 70000 },
  ],
  shippingMethod: "standard",
  paymentMethod: "cod",
  totals: { subtotal: 130000, discount: 0, shipping: 0, total: 130000 },
} as unknown as Order;

describe("Meta Purchase event", () => {
  it("has the Pixel's values, the order id as event id, and only the listed customer data", async () => {
    const signal: BrowserSignal = { ip: "41.1.2.3", userAgent: "Mozilla/5.0", fbp: "fb.1.1700.123", fbc: "fb.1.1700.abc", sourceUrl: `${ORIGIN}/collections/vicuna-belts/lace/` };
    const e = await purchaseEvent(order, signal);
    assert.equal(e["event_name"], "Purchase");
    assert.equal(e["event_id"], "V-1017-ABCDE");
    assert.equal(e["event_time"], Date.parse("2026-10-17T05:00:00.000Z") / 1000);
    assert.equal(e["action_source"], "website");
    assert.equal(e["event_source_url"], `${ORIGIN}/collections/vicuna-belts/lace/`);
    assert.deepEqual(e["custom_data"], {
      currency: "EGP",
      value: 1300,
      content_type: "product",
      content_ids: ["lace-white", "pattern-brown"],
      contents: [{ id: "lace-white", quantity: 2, item_price: 300 }, { id: "pattern-brown", quantity: 1, item_price: 700 }],
      num_items: 3,
      order_id: "V-1017-ABCDE",
    });
    assert.deepEqual(e["user_data"], {
      ph: [sha("201012345678")],
      country: [sha("eg")],
      client_ip_address: "41.1.2.3",
      client_user_agent: "Mozilla/5.0",
      fbp: "fb.1.1700.123",
      fbc: "fb.1.1700.abc",
    });
    const text = JSON.stringify(e);
    for (const secret of ["01012345678", "201012345678", "منى", "مدينة نصر", "القاهرة"]) assert.ok(!text.includes(secret), `${secret} must not be sent`);
  });

  it("phone in Meta's format, only for a valid Egyptian mobile", () => {
    assert.equal(metaPhone("01012345678"), "201012345678");
    assert.equal(metaPhone("1012345678"), null);
  });

  it("reads Meta's cookies", () => {
    assert.equal(cookieValue("a=1; _fbp=fb.1.2.3; _fbc=fb.1.2.x", "_fbp"), "fb.1.2.3");
    assert.equal(cookieValue("a=1", "_fbp"), undefined);
    assert.equal(cookieValue(null, "_fbp"), undefined);
  });

  it("posts to the dataset with the token in the body, and errors never carry the token", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const ok = ((url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    await metaPurchaseReporter("2311877842998870", "tok-123", "TEST1", ok)(order, {});
    assert.match(calls[0]!.url, /^https:\/\/graph\.facebook\.com\/v\d+\.0\/2311877842998870\/events$/);
    assert.ok(!calls[0]!.url.includes("tok-123"));
    assert.equal(calls[0]!.body["access_token"], "tok-123");
    assert.equal(calls[0]!.body["test_event_code"], "TEST1");
    const bad = (() => Promise.resolve(new Response("no", { status: 400 }))) as unknown as typeof fetch;
    await assert.rejects(metaPurchaseReporter("1", "tok-123", undefined, bad)(order, {}), (e: Error) => e.message === "meta_http_400" && !e.message.includes("tok"));
  });
});

describe("order API and Meta", () => {
  const setup = (report: (o: Order, s: BrowserSignal) => Promise<void>) => {
    const reported: string[] = [];
    let n = 0;
    const handler = createHandler({
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository: memoryRepository(),
      allowedOrigins: [ORIGIN],
      now: () => new Date("2026-10-17T05:00:00Z"),
      randomBytes: (len) => Uint8Array.from({ length: len }, () => n++),
      reportError: (e) => reported.push(e),
      reportPurchase: report,
    });
    return { handler, reported };
  };
  const post = (extra: Record<string, unknown>) =>
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, Referer: `${ORIGIN}/collections/vicuna-belts/lace/#x`, "CF-Connecting-IP": "41.1.2.3", "User-Agent": "UA", Cookie: "_fbp=fb.1.9.9" },
      body: JSON.stringify({
        items: [{ id: "lace-white", quantity: 1 }],
        customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد، عمارة 21" },
        shippingMethod: "standard",
        paymentMethod: "cod",
        ...extra,
      }),
    });

  it("sends with consent, with the browser's signal", async () => {
    const seen: Array<{ id: string; s: BrowserSignal }> = [];
    const { handler } = setup(async (o, s) => void seen.push({ id: o.id, s }));
    const res = await handler(post({ consent: true }));
    assert.equal(res.status, 201);
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0]!.s, { ip: "41.1.2.3", userAgent: "UA", fbp: "fb.1.9.9", sourceUrl: `${ORIGIN}/collections/vicuna-belts/lace/` });
  });

  it("sends nothing without consent", async () => {
    let called = 0;
    const { handler } = setup(async () => void called++);
    assert.equal((await handler(post({}))).status, 201);
    assert.equal((await handler(post({ consent: "yes" }))).status, 201);
    assert.equal(called, 0);
  });

  it("a Meta failure never fails the order", async () => {
    const { handler, reported } = setup(async () => {
      throw new Error("meta_http_500");
    });
    assert.equal((await handler(post({ consent: true }))).status, 201);
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(reported.some((r) => r.startsWith("purchase_report_failed")));
  });
});
