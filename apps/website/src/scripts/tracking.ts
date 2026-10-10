// Analytics and ad tags (GA4, Meta Pixel, TikTok Pixel, Snap Pixel), loaded only after the visitor accepts cookies.
// Events: page view on every page, view_item on a product page, add_to_cart, begin_checkout, purchase (thank-you page).
// The choice is kept in localStorage ("vicuna-consent": "granted" | "denied"); "Cookie settings" in the footer reopens it.
import { tracking } from "../site.ts";

type Item = { id: string; name?: string; price?: number; quantity?: number };
export type TrackEvent =
  | { type: "view_item"; item: Item }
  | { type: "add_to_cart"; item: Item }
  | { type: "begin_checkout"; value: number; items: Item[] }
  | { type: "purchase"; orderId: string; value: number };

const CONSENT_KEY = "vicuna-consent";
type W = Window & Record<string, unknown>;
const w = window as unknown as W;

export function consent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: "granted" | "denied"): void {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  if (v === "granted") load();
}

const pending: TrackEvent[] = [];
let loaded = false;

function script(src: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.append(s);
}

function load(): void {
  if (loaded) return;
  loaded = true;
  if (tracking.ga4) {
    w["dataLayer"] = (w["dataLayer"] as unknown[]) ?? [];
    const gtag = function (...args: unknown[]) {
      (w["dataLayer"] as unknown[]).push(args);
    };
    w["gtag"] = gtag;
    gtag("js", new Date());
    gtag("config", tracking.ga4);
    script(`https://www.googletagmanager.com/gtag/js?id=${tracking.ga4}`);
  }
  if (tracking.meta) {
    const fbq = function (...args: unknown[]) {
      const f = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (f.callMethod) f.callMethod(...args);
      else f.queue.push(args);
    } as unknown as Record<string, unknown>;
    fbq["queue"] = [];
    fbq["loaded"] = true;
    fbq["version"] = "2.0";
    fbq["push"] = fbq;
    w["fbq"] = fbq;
    w["_fbq"] = fbq;
    script("https://connect.facebook.net/en_US/fbevents.js");
    call("fbq", "init", tracking.meta);
    call("fbq", "track", "PageView");
  }
  if (tracking.tiktok) {
    const q: unknown[] = [];
    const ttq: Record<string, unknown> = { _q: q };
    for (const m of ["page", "track", "identify", "load"]) ttq[m] = (...a: unknown[]) => q.push([m, ...a]);
    w["ttq"] = ttq;
    script(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${tracking.tiktok}&lib=ttq`);
    call("ttq", "page");
  }
  if (tracking.snapchat) {
    const snaptr = function (...args: unknown[]) {
      const s = snaptr as unknown as { handleRequest?: (...a: unknown[]) => void; queue: unknown[] };
      if (s.handleRequest) s.handleRequest(...args);
      else s.queue.push(args);
    } as unknown as Record<string, unknown>;
    snaptr["queue"] = [];
    w["snaptr"] = snaptr;
    script("https://sc-static.net/scevent.min.js");
    call("snaptr", "init", tracking.snapchat);
    call("snaptr", "track", "PAGE_VIEW");
  }
  for (const e of pending.splice(0)) send(e);
}

function call(name: string, ...args: unknown[]): void {
  const fn = w[name];
  if (typeof fn === "function") (fn as (...a: unknown[]) => void)(...args);
}

const egp = (piasters: number) => piasters / 100;

function send(e: TrackEvent): void {
  switch (e.type) {
    case "view_item": {
      const v = egp(e.item.price ?? 0);
      call("gtag", "event", "view_item", { currency: "EGP", value: v, items: [{ item_id: e.item.id, item_name: e.item.name }] });
      call("fbq", "track", "ViewContent", { content_ids: [e.item.id], content_type: "product", value: v, currency: "EGP" });
      call("ttq", "track", "ViewContent", { content_id: e.item.id, value: v, currency: "EGP" });
      call("snaptr", "track", "VIEW_CONTENT", { item_ids: [e.item.id], price: v, currency: "EGP" });
      break;
    }
    case "add_to_cart": {
      const v = egp(e.item.price ?? 0);
      call("gtag", "event", "add_to_cart", { currency: "EGP", value: v, items: [{ item_id: e.item.id, item_name: e.item.name, quantity: 1 }] });
      call("fbq", "track", "AddToCart", { content_ids: [e.item.id], content_type: "product", value: v, currency: "EGP" });
      call("ttq", "track", "AddToCart", { content_id: e.item.id, value: v, currency: "EGP" });
      call("snaptr", "track", "ADD_CART", { item_ids: [e.item.id], price: v, currency: "EGP" });
      break;
    }
    case "begin_checkout": {
      const v = egp(e.value);
      const ids = e.items.map((i) => i.id);
      call("gtag", "event", "begin_checkout", { currency: "EGP", value: v, items: e.items.map((i) => ({ item_id: i.id, quantity: i.quantity })) });
      call("fbq", "track", "InitiateCheckout", { content_ids: ids, content_type: "product", value: v, currency: "EGP", num_items: ids.length });
      call("ttq", "track", "InitiateCheckout", { value: v, currency: "EGP" });
      call("snaptr", "track", "START_CHECKOUT", { item_ids: ids, price: v, currency: "EGP" });
      break;
    }
    case "purchase": {
      const v = egp(e.value);
      call("gtag", "event", "purchase", { transaction_id: e.orderId, currency: "EGP", value: v });
      call("fbq", "track", "Purchase", { value: v, currency: "EGP" }, { eventID: e.orderId });
      call("ttq", "track", "CompletePayment", { value: v, currency: "EGP" });
      call("snaptr", "track", "PURCHASE", { transaction_id: e.orderId, price: v, currency: "EGP" });
      break;
    }
  }
}

/** Sends the event if the visitor accepted cookies; keeps it until they decide; drops it if they refused. */
export function track(e: TrackEvent): void {
  const c = consent();
  if (c === "denied") return;
  if (loaded) send(e);
  else pending.push(e);
}

/** Called once per page by the consent banner. */
export function initTracking(): void {
  if (consent() === "granted") load();
}
