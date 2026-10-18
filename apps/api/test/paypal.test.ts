// PayPal (ADR 0014): the order is placed first, then paid in US dollars. The amount always comes from the stored order
// and the owner's rate; a payment is checked at PayPal before the money is taken.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, lookupProduct } from "@platform/commerce";
import {
  PaypalDeclined, createAdminHandler, createHandler, d1Repository, formatOrderMessage, formatPaymentMessage, memoryRepository, paypalApi, readOrder,
} from "../src/index.ts";
import type { OrderRepository, PaypalApi, PaypalOrderInfo, StoredOrder } from "../src/index.ts";
import { sqliteD1 } from "./sqlite-d1.ts";

const ORIGIN = "https://staging.vicuna-eg.com";
const NOW = new Date("2026-10-18T10:00:00Z");
const RATE = 5_000; // 50 EGP per dollar

/** A fake PayPal: orders it made, and what each call returns. */
function fakePaypal() {
  const orders = new Map<string, PaypalOrderInfo>();
  const calls: string[] = [];
  let n = 0;
  let captureResult: (info: PaypalOrderInfo) => PaypalOrderInfo = (info) => ({ ...info, status: "COMPLETED", capture: { id: `CAP${info.id}`, status: "COMPLETED" } });
  const api: PaypalApi = {
    createOrder({ orderId, usdCents }) {
      const id = `PP${String(++n).padStart(8, "0")}`;
      orders.set(id, { id, status: "CREATED", customId: orderId, currency: "USD", cents: usdCents, capture: null });
      calls.push(`create:${id}:${usdCents}`);
      return Promise.resolve(id);
    },
    getOrder(id) {
      calls.push(`get:${id}`);
      const o = orders.get(id);
      return o ? Promise.resolve({ ...o }) : Promise.reject(new Error("paypal_http_404"));
    },
    captureOrder(id) {
      calls.push(`capture:${id}`);
      const o = orders.get(id)!;
      const next = captureResult(o);
      orders.set(id, next);
      return Promise.resolve({ ...next });
    },
  };
  return {
    api,
    orders,
    calls,
    approve: (id: string) => orders.set(id, { ...orders.get(id)!, status: "APPROVED" }),
    onCapture: (f: typeof captureResult) => (captureResult = f),
  };
}

function app(repository: OrderRepository, withPaypal = true) {
  const paypal = fakePaypal();
  const payments: Array<{ order: StoredOrder; state: string }> = [];
  let n = 0;
  const handler = createHandler({
    lookup: lookupProduct, shipping: SHIPPING, repository, allowedOrigins: [ORIGIN],
    now: () => NOW, randomBytes: (len) => Uint8Array.from({ length: len }, () => n++),
    ...(withPaypal ? { paypal: { api: paypal.api, clientId: "client-123" } } : {}),
    notifyPayment: (order, state) => {
      payments.push({ order, state });
      return Promise.resolve();
    },
  });
  return { handler, paypal, payments, repository };
}

const post = (path: string, body: unknown, origin = ORIGIN) =>
  new Request(`${ORIGIN}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });

async function placeOrder(handler: (r: Request) => Promise<Response>, paymentMethod = "paypal"): Promise<{ id: string; total: number }> {
  const res = await handler(
    post("/orders", {
      items: [{ id: "lace-white", quantity: 1 }],
      customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" },
      paymentMethod,
    }),
  );
  assert.equal(res.status, 201);
  const { order } = (await res.json()) as { order: { id: string; paymentMethod: string; totals: { total: number } } };
  assert.equal(order.paymentMethod, paymentMethod);
  return { id: order.id, total: order.totals.total };
}

describe("PayPal config", () => {
  it("is off without credentials or without a rate, and on with both", async () => {
    const config = async (a: ReturnType<typeof app>) => (await a.handler(new Request(`${ORIGIN}/api/paypal/config`, { headers: { Origin: ORIGIN } }))).json();
    const repo = memoryRepository();
    assert.deepEqual(await config(app(repo, false)), { enabled: false });
    assert.deepEqual(await config(app(repo)), { enabled: false }, "no rate yet");
    await repo.setUsdRate(RATE, NOW.toISOString());
    assert.deepEqual(await config(app(repo)), { enabled: true, clientId: "client-123", usdRate: RATE });
    assert.deepEqual(await config(app(repo, false)), { enabled: false });
  });
});

describe("PayPal payment", () => {
  for (const [name, makeRepo] of [["memory", () => memoryRepository()], ["D1", () => d1Repository(sqliteD1())]] as const) {
    it(`takes the payment for the stored total and marks the order paid (${name})`, async () => {
      const repo = makeRepo();
      await repo.setUsdRate(RATE, NOW.toISOString());
      const { handler, paypal, payments } = app(repo);
      const { id, total } = await placeOrder(handler);
      const expected = Math.ceil((total * 100) / RATE);

      // A price sent by the browser is ignored.
      const created = await handler(post("/paypal/orders", { orderId: id, usdCents: 1 }));
      assert.equal(created.status, 201);
      const { id: ppId, usdCents } = (await created.json()) as { id: string; usdCents: number };
      assert.equal(usdCents, expected);
      assert.equal((await repo.getOrder(id))?.paypal?.orderId, ppId);

      paypal.approve(ppId);
      const captured = await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }));
      assert.equal(captured.status, 200);
      assert.deepEqual(await captured.json(), { paid: true });
      const stored = await repo.getOrder(id);
      assert.equal(stored?.paymentMethod, "paypal");
      assert.equal(stored?.paypal?.paidAt, NOW.toISOString());
      assert.equal(stored?.paypal?.captureId, `CAP${ppId}`);
      assert.equal((await repo.listOrders({ limit: 10 }))[0]?.paid, true);
      assert.deepEqual(payments.map((p) => p.state), ["paid"]);
      assert.deepEqual(paypal.calls, [`create:${ppId}:${expected}`, `get:${ppId}`, `capture:${ppId}`, `get:${ppId}`]);

      // Repeating the capture changes nothing and takes nothing again; a new PayPal order is refused.
      assert.deepEqual(await (await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }))).json(), { paid: true });
      assert.equal(paypal.calls.length, 4);
      const again = await handler(post("/paypal/orders", { orderId: id }));
      assert.equal(again.status, 409);
      assert.deepEqual(await again.json(), { error: "already_paid" });
      assert.equal(payments.length, 1);
    });
  }

  it("stores a PayPal order as instapay + paypal = 1 (the old CHECK) and reads it back as PayPal", async () => {
    const db = sqliteD1();
    const repo = d1Repository(db);
    const { handler } = app(repo);
    const { id } = await placeOrder(handler);
    const row = db.sqlite.prepare("SELECT payment_method, paypal, paid_at FROM orders WHERE id = ?").get(id) as Record<string, unknown>;
    assert.deepEqual({ ...row }, { payment_method: "instapay", paypal: 1, paid_at: null });
    const cod = await placeOrder(handler, "cod");
    assert.equal((await repo.getOrder(cod.id))?.paypal, undefined);
    assert.equal((await repo.getOrder(id))?.paypal?.paidAt, null);
  });

  it("never takes money when PayPal shows another amount, currency or order", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler, paypal } = app(repo);
    const { id } = await placeOrder(handler);
    const { id: ppId } = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    for (const change of [{ cents: 1 }, { currency: "EUR" }, { customId: "V-0000-XXXXX" }]) {
      paypal.orders.set(ppId, { ...paypal.orders.get(ppId)!, status: "APPROVED", cents: paypal.orders.get(ppId)!.cents, currency: "USD", customId: id, ...change });
      const res = await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }));
      assert.equal(res.status, 409, JSON.stringify(change));
      assert.deepEqual(await res.json(), { error: "payment_mismatch" });
    }
    assert.ok(!paypal.calls.some((c) => c.startsWith("capture:")));
    assert.equal((await repo.getOrder(id))?.paypal?.paidAt, null);
  });

  it("refuses a PayPal order that is not the one recorded, and unknown or non-PayPal orders", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler } = app(repo);
    const { id } = await placeOrder(handler);
    const first = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    const second = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    const stale = await handler(post("/paypal/capture", { orderId: id, paypalOrderId: first.id }));
    assert.equal(stale.status, 409, "replaced by the second PayPal order");
    assert.notEqual(first.id, second.id);
    const cod = await placeOrder(handler, "cod");
    assert.equal((await handler(post("/paypal/orders", { orderId: cod.id }))).status, 404);
    assert.equal((await handler(post("/paypal/orders", { orderId: "V-0101-ZZZZZ" }))).status, 404);
    assert.equal((await handler(post("/paypal/orders", { orderId: "<script>" }))).status, 400);
    assert.equal((await handler(post("/paypal/orders", { orderId: id }, "https://evil.example"))).status, 403);
  });

  it("does not open PayPal for a cancelled order or without a rate", async () => {
    const repo = memoryRepository();
    const { handler } = app(repo);
    const { id } = await placeOrder(handler);
    const noRate = await handler(post("/paypal/orders", { orderId: id }));
    assert.equal(noRate.status, 503);
    await repo.setUsdRate(RATE, NOW.toISOString());
    await repo.setStatus(id, "new", "cancelled", 0, NOW.toISOString(), "c1");
    const res = await handler(post("/paypal/orders", { orderId: id }));
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "order_cancelled" });
  });

  it("a declined card lets the customer try again; a payment PayPal holds is not marked paid", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler, paypal, payments } = app(repo);
    const { id } = await placeOrder(handler);
    const { id: ppId } = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    paypal.approve(ppId);
    paypal.onCapture(() => {
      throw new PaypalDeclined();
    });
    assert.equal((await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }))).status, 402);
    paypal.onCapture((info) => ({ ...info, status: "COMPLETED", capture: { id: "CAPX", status: "PENDING" } }));
    const held = await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }));
    assert.equal(held.status, 202);
    assert.deepEqual(await held.json(), { paid: false, pending: true });
    assert.equal((await repo.getOrder(id))?.paypal?.paidAt, null);
    assert.deepEqual(payments.map((p) => p.state), ["pending"]);
  });

  it("trusts PayPal's full order, not the capture's short reply that leaves out our id", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler, paypal } = app(repo);
    const { id } = await placeOrder(handler);
    const { id: ppId } = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    paypal.approve(ppId);
    const realCapture = paypal.api.captureOrder.bind(paypal.api);
    paypal.api.captureOrder = async (ppid) => ({ ...(await realCapture(ppid)), customId: null, cents: null, currency: null });
    const res = await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }));
    assert.equal(res.status, 200);
    assert.ok((await repo.getOrder(id))?.paypal?.paidAt);
  });

  it("never charges twice: a PayPal order already paid is recorded instead of making a new one", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler, paypal, payments } = app(repo);
    const { id } = await placeOrder(handler);
    const { id: ppId } = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    // The customer paid, but the page never got the answer.
    paypal.orders.set(ppId, { ...paypal.orders.get(ppId)!, status: "COMPLETED", capture: { id: "CAPLOST", status: "COMPLETED" } });
    const again = await handler(post("/paypal/orders", { orderId: id }));
    assert.equal(again.status, 409);
    assert.deepEqual(await again.json(), { error: "already_paid" });
    assert.equal(paypal.calls.filter((c) => c.startsWith("create:")).length, 1);
    assert.equal((await repo.getOrder(id))?.paypal?.captureId, "CAPLOST");
    assert.deepEqual(payments.map((p) => p.state), ["paid"]);
  });

  it("tells why PayPal refused a capture, with PayPal's label only", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler, paypal } = app(repo);
    const { id } = await placeOrder(handler);
    const { id: ppId } = (await (await handler(post("/paypal/orders", { orderId: id }))).json()) as { id: string };
    paypal.approve(ppId);
    paypal.api.captureOrder = () => Promise.reject(new Error("paypal_http_422_PAYEE_ACCOUNT_RESTRICTED"));
    const res = await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }));
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: "paypal_error", detail: "paypal_http_422_PAYEE_ACCOUNT_RESTRICTED" });
    paypal.api.captureOrder = () => Promise.reject(new Error("D1_ERROR: something with 01012345678"));
    assert.deepEqual(await (await handler(post("/paypal/capture", { orderId: id, paypalOrderId: ppId }))).json(), { error: "paypal_error" });
  });

  it("does not open PayPal for an order with nothing to pay", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    await repo.createPromo({ code: "FREE", amount: 1_000_000, minSubtotal: 0, maxUses: null, expiresAt: null }, NOW.toISOString());
    const { handler, paypal } = app(repo);
    const res = await handler(
      post("/orders", { items: [{ id: "lace-white", quantity: 1 }], customer: { name: "منى أحمد", phone: "01012345678" }, shippingMethod: "pickup", paymentMethod: "paypal", promoCode: "FREE" }),
    );
    assert.equal(res.status, 201);
    const { order } = (await res.json()) as { order: { id: string; totals: { total: number } } };
    assert.equal(order.totals.total, 0);
    const opened = await handler(post("/paypal/orders", { orderId: order.id }));
    assert.equal(opened.status, 409);
    assert.deepEqual(await opened.json(), { error: "nothing_to_pay" });
    assert.equal(paypal.calls.length, 0);
  });

  it("answers 503 when PayPal is not set up", async () => {
    const { handler } = app(memoryRepository(), false);
    const { id } = await placeOrder(handler);
    assert.equal((await handler(post("/paypal/orders", { orderId: id }))).status, 503);
  });
});

describe("PayPal API client", () => {
  function recorder(responses: Array<{ status?: number; body: unknown }>) {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = ((url: string, init: RequestInit) => {
      requests.push({ url, init });
      const next = responses.shift()!;
      return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status ?? 200 }));
    }) as unknown as typeof fetch;
    return { requests, fetchImpl };
  }
  const token = { body: { access_token: "tok" } };

  it("gets a token with the app's id and secret, then makes a USD order tagged with our order id", async () => {
    const r = recorder([token, { status: 201, body: { id: "5O190127TN364715T", status: "CREATED" } }]);
    const api = paypalApi({ clientId: "id", secret: "sec", environment: "sandbox" }, r.fetchImpl);
    assert.equal(await api.createOrder({ orderId: "V-1018-AAAAA", usdCents: 1361, description: "Vicuna order V-1018-AAAAA" }), "5O190127TN364715T");
    assert.equal(r.requests[0]?.url, "https://api-m.sandbox.paypal.com/v1/oauth2/token");
    assert.equal((r.requests[0]?.init.headers as Record<string, string>)["Authorization"], `Basic ${btoa("id:sec")}`);
    const body = JSON.parse(String(r.requests[1]?.init.body)) as { purchase_units: Array<Record<string, unknown>> };
    assert.deepEqual(body.purchase_units[0]?.["amount"], { currency_code: "USD", value: "13.61" });
    assert.equal(body.purchase_units[0]?.["custom_id"], "V-1018-AAAAA");
    assert.equal((r.requests[1]?.init.headers as Record<string, string>)["Authorization"], "Bearer tok");
  });

  it("uses the live host for live, and a fixed request id on capture so a repeat is safe", async () => {
    const r = recorder([token, { status: 201, body: { id: "ABCDEFGH12", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "C1", status: "COMPLETED", custom_id: "V-1", amount: { currency_code: "USD", value: "13.61" } }] } }] } }]);
    const api = paypalApi({ clientId: "id", secret: "sec", environment: "live" }, r.fetchImpl);
    const info = await api.captureOrder("ABCDEFGH12");
    assert.equal(r.requests[1]?.url, "https://api-m.paypal.com/v2/checkout/orders/ABCDEFGH12/capture");
    assert.equal((r.requests[1]?.init.headers as Record<string, string>)["PayPal-Request-Id"], "capture-ABCDEFGH12");
    assert.deepEqual(info, { id: "ABCDEFGH12", status: "COMPLETED", customId: "V-1", currency: "USD", cents: 1361, capture: { id: "C1", status: "COMPLETED" } });
  });

  it("turns a declined card into PaypalDeclined, and other failures into a plain label without the secret", async () => {
    const declined = recorder([token, { status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } }]);
    await assert.rejects(paypalApi({ clientId: "id", secret: "sec", environment: "sandbox" }, declined.fetchImpl).captureOrder("ABCDEFGH12"), PaypalDeclined);
    const badToken = recorder([{ status: 401, body: { error: "invalid_client" } }]);
    await assert.rejects(paypalApi({ clientId: "id", secret: "sec", environment: "sandbox" }, badToken.fetchImpl).getOrder("ABCDEFGH12"), (e: Error) => e.message === "paypal_token_http_401");
  });

  it("reads an approved order's amount and our id", () => {
    assert.deepEqual(readOrder({ id: "X1", status: "APPROVED", purchase_units: [{ custom_id: "V-2", amount: { currency_code: "USD", value: "20.00" } }] }), {
      id: "X1", status: "APPROVED", customId: "V-2", currency: "USD", cents: 2000, capture: null,
    });
    assert.throws(() => readOrder({ status: "APPROVED" }));
  });
});

describe("PayPal in the admin and in Telegram", () => {
  it("lets the owner set the dollar rate, within 10 to 1000 EGP", async () => {
    const repo = memoryRepository();
    const admin = createAdminHandler({ repository: repo, verify: () => Promise.resolve("owner@example.com"), now: () => NOW, randomBytes: (n) => new Uint8Array(n) });
    const put = (usdRate: unknown) =>
      admin(new Request("https://admin.vicuna-eg.com/api/settings", { method: "PUT", headers: { "X-Vicuna-Admin": "1", "Content-Type": "application/json" }, body: JSON.stringify({ usdRate }) }), "/admin/api/settings");
    assert.deepEqual(await (await admin(new Request("https://admin.vicuna-eg.com/api/settings"), "/admin/api/settings")).json(), { usdRate: null });
    assert.equal((await put(999)).status, 400);
    assert.equal((await put("5000")).status, 400);
    assert.equal((await put(4_850)).status, 200);
    assert.equal(await repo.usdRate(), 4_850);
    const noHeader = await admin(new Request("https://admin.vicuna-eg.com/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" }), "/admin/api/settings");
    assert.equal(noHeader.status, 403);
  });

  it("tells the owner a PayPal order is not paid yet, and then that it was paid", async () => {
    const repo = memoryRepository();
    await repo.setUsdRate(RATE, NOW.toISOString());
    const { handler } = app(repo);
    const { id } = await placeOrder(handler);
    const order = (await repo.getOrder(id))!;
    assert.match(formatOrderMessage(order), /الدفع: PayPal بالدولار \(لسه ما اتدفعش/);
    const paid = { ...order, paypal: { orderId: "PP1", usdCents: 1361, captureId: "CAP1", paidAt: NOW.toISOString() } };
    const text = formatPaymentMessage(paid, "paid", NOW);
    assert.match(text, new RegExp(`^✅ اتدفع بـ PayPal: الطلب ${id}`));
    assert.match(text, /\$13\.61/);
    assert.match(text, /CAP1/);
    assert.match(formatPaymentMessage(paid, "pending", NOW), /قبل ما تشحن/);
  });
});
