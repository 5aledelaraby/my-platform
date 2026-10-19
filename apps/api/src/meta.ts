// Meta Conversions API: the order's Purchase event, sent from the server as well as from the browser's Meta Pixel
// (owner, 2026-10-17), so a purchase still reaches Meta when the browser blocks the Pixel (ad blockers, iPhone
// tracking protection). Meta counts it once: both carry the order id as the event id.
//
// Rules this file keeps:
// - Only when the order says `consent: true`: the site sends it unless the visitor turned the tags off in "Cookie settings", exactly like the Pixel.
// - Only what the privacy policy lists for Meta (owner, 2026-10-17: "send what helps us and Meta without causing
//   problems"): the order id, value and products, the browser (IP address and user agent), the Meta cookie ids,
//   and the mobile number and country hashed with SHA-256 (Meta matches the hash; the number itself never leaves).
//   Never the name or the address.
// - The access token is a Cloudflare secret; it goes in the request body (never in a URL or a log), and errors carry
//   only the HTTP status.
import type { Order } from "@platform/commerce";

/** Graph API version used for the Conversions API. */
export const GRAPH_VERSION = "v26.0";

/** What the order request tells about the visitor's browser (all optional). */
export interface BrowserSignal {
  ip?: string;
  userAgent?: string;
  /** Meta's browser cookie `_fbp`. */
  fbp?: string;
  /** Meta's click cookie `_fbc` (only when the visitor came from a Meta ad). */
  fbc?: string;
  /** The page the order was placed from. */
  sourceUrl?: string;
}

/** Sends one order's Purchase event. */
export type PurchaseReporter = (order: Order, signal: BrowserSignal) => Promise<void>;

const egp = (piasters: number) => piasters / 100;

/** Lower-case hex SHA-256, the form Meta expects for customer information. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** An Egyptian mobile as stored ("01012345678") in Meta's format: country code, digits only ("201012345678"). */
export const metaPhone = (phone: string): string | null => (/^01\d{9}$/.test(phone) ? `2${phone}` : null);

/** The Purchase event, with the same values the browser's Pixel sends on the thank-you page (scripts/tracking.ts). */
export async function purchaseEvent(order: Order, signal: BrowserSignal): Promise<Record<string, unknown>> {
  const userData: Record<string, string | string[]> = {};
  const phone = metaPhone(order.customer.phone);
  if (phone) userData["ph"] = [await sha256Hex(phone)];
  userData["country"] = [await sha256Hex("eg")];
  if (signal.ip) userData["client_ip_address"] = signal.ip;
  if (signal.userAgent) userData["client_user_agent"] = signal.userAgent;
  if (signal.fbp) userData["fbp"] = signal.fbp;
  if (signal.fbc) userData["fbc"] = signal.fbc;
  return {
    event_name: "Purchase",
    event_time: Math.floor(new Date(order.createdAt).getTime() / 1000),
    event_id: order.id,
    action_source: "website",
    ...(signal.sourceUrl ? { event_source_url: signal.sourceUrl } : {}),
    user_data: userData,
    custom_data: {
      currency: "EGP",
      value: egp(order.totals.total),
      content_type: "product",
      content_ids: order.items.map((i) => i.productId),
      contents: order.items.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: egp(i.unitPrice) })),
      num_items: order.items.reduce((n, i) => n + i.quantity, 0),
      order_id: order.id,
    },
  };
}

/**
 * Sends Purchase events to one Meta dataset (Pixel id). With `testEventCode` they show only under Events Manager >
 * Test events and are not counted (used for orders placed on staging).
 */
export function metaPurchaseReporter(pixelId: string, token: string, testEventCode?: string, fetchImpl: typeof fetch = fetch): PurchaseReporter {
  return async (order, signal) => {
    const res = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [await purchaseEvent(order, signal)], access_token: token, ...(testEventCode ? { test_event_code: testEventCode } : {}) }),
    });
    if (!res.ok) throw new Error(`meta_http_${res.status}`);
  };
}

/** A cookie's value from a Cookie header, or undefined. */
export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) {
      const value = part.slice(at + 1).trim();
      return value && value.length <= 500 ? value : undefined;
    }
  }
  return undefined;
}
