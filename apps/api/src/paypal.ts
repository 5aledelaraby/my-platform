// PayPal Orders API v2 (ADR 0014), server side only. The client secret stays inside this module: it is sent only to
// PayPal's token endpoint, never logged, and errors carry only the HTTP status or PayPal's issue name.
// Staging uses the PayPal sandbox with its own credentials; the live site uses the live account (worker.ts).
import { formatUsd, parseUsd } from "@platform/commerce";

export type PaypalEnvironment = "sandbox" | "live";

export interface PaypalCredentials {
  clientId: string;
  secret: string;
  environment: PaypalEnvironment;
}

/** A PayPal order as this app needs it. */
export interface PaypalOrderInfo {
  id: string;
  /** CREATED, APPROVED, COMPLETED, VOIDED, ... */
  status: string;
  /** Our order id, sent as custom_id when the PayPal order was made. */
  customId: string | null;
  currency: string | null;
  cents: number | null;
  /** The capture, once the money is taken (status COMPLETED or PENDING). */
  capture: { id: string; status: string } | null;
}

export interface PaypalApi {
  /** Makes a PayPal order for `usdCents` dollars-cents, tagged with our order id. Returns PayPal's order id. */
  createOrder(input: { orderId: string; usdCents: number; description: string }): Promise<string>;
  getOrder(paypalOrderId: string): Promise<PaypalOrderInfo>;
  /** Takes the money for an approved PayPal order. Safe to repeat: PayPal answers a repeat with the first result. */
  captureOrder(paypalOrderId: string): Promise<PaypalOrderInfo>;
}

/** PayPal refused the buyer's card or account; the buyer can choose another way to pay and try again. */
export class PaypalDeclined extends Error {
  constructor() {
    super("paypal_declined");
    this.name = "PaypalDeclined";
  }
}

const BASE: Record<PaypalEnvironment, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/** PayPal order ids are short upper-case letters and digits. */
export const PAYPAL_ORDER_ID = /^[A-Z0-9]{8,40}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function readOrder(body: unknown): PaypalOrderInfo {
  if (!isRecord(body) || typeof body["id"] !== "string" || typeof body["status"] !== "string") throw new Error("paypal_bad_response");
  const unit = Array.isArray(body["purchase_units"]) && isRecord(body["purchase_units"][0]) ? body["purchase_units"][0] : {};
  const amount = isRecord(unit["amount"]) ? unit["amount"] : {};
  const payments = isRecord(unit["payments"]) ? unit["payments"] : {};
  const first = Array.isArray(payments["captures"]) && isRecord(payments["captures"][0]) ? payments["captures"][0] : null;
  const captureAmount = first && isRecord(first["amount"]) ? first["amount"] : null;
  // Once captured, the capture's own amount is the money actually taken.
  const money = captureAmount ?? amount;
  return {
    id: body["id"],
    status: body["status"],
    customId: str(unit["custom_id"]) ?? (first ? str(first["custom_id"]) : null),
    currency: str(money["currency_code"]),
    cents: parseUsd(money["value"]),
    capture: first && typeof first["id"] === "string" && typeof first["status"] === "string" ? { id: first["id"], status: first["status"] } : null,
  };
}

export function paypalApi(credentials: PaypalCredentials, fetchImpl: typeof fetch = fetch): PaypalApi {
  const base = BASE[credentials.environment];

  async function token(): Promise<string> {
    const res = await fetchImpl(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.secret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`paypal_token_http_${res.status}`);
    const body: unknown = await res.json();
    const value = isRecord(body) ? str(body["access_token"]) : null;
    if (!value) throw new Error("paypal_token_missing");
    return value;
  }

  async function call(method: string, path: string, body?: unknown, requestId?: string): Promise<unknown> {
    // The full order in every reply: by default PayPal may answer with a shorter form that leaves out custom_id.
    const headers: Record<string, string> = { Authorization: `Bearer ${await token()}`, Accept: "application/json", Prefer: "return=representation" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (requestId) headers["PayPal-Request-Id"] = requestId;
    const res = await fetchImpl(`${base}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const issue = isRecord(data) && Array.isArray(data["details"]) && isRecord(data["details"][0]) ? str(data["details"][0]["issue"]) : null;
      if (issue === "INSTRUMENT_DECLINED" || issue === "PAYER_ACTION_REQUIRED") throw new PaypalDeclined();
      throw new Error(`paypal_http_${res.status}${issue ? `_${issue.replace(/[^A-Z_]/g, "")}` : ""}`);
    }
    return data;
  }

  return {
    async createOrder({ orderId, usdCents, description }) {
      const body = {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderId,
            custom_id: orderId,
            description: description.slice(0, 127),
            amount: { currency_code: "USD", value: formatUsd(usdCents) },
          },
        ],
        // The delivery address is in our order already; PayPal must not ask for another one.
        application_context: { brand_name: "Vicuna", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
      };
      const order = readOrder(await call("POST", "/v2/checkout/orders", body));
      if (!PAYPAL_ORDER_ID.test(order.id)) throw new Error("paypal_bad_response");
      return order.id;
    },
    async getOrder(paypalOrderId) {
      return readOrder(await call("GET", `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`));
    },
    async captureOrder(paypalOrderId) {
      return readOrder(await call("POST", `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {}, `capture-${paypalOrderId}`));
    },
  };
}
