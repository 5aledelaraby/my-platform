// Analytics and ad tags (GA4, Meta Pixel, TikTok Pixel, Snap Pixel), loaded only after the visitor accepts cookies.
// Only tags with an ID in site.ts `tracking` ever load. Events: page view on every page, view_item on a product page,
// add_to_cart, begin_checkout, purchase (thank-you page).
// The choice is kept in localStorage ("vicuna-consent": "granted" | "denied"); "Cookie settings" in the footer reopens it.
//
// Rules this file keeps:
// - Nothing loads and nothing is sent before "Accept". Events that happen before the choice are dropped, never queued.
// - Withdrawing ("Reject" after an earlier "Accept") tells each loaded tag to stop in the way its vendor documents,
//   deletes the tags' first-party cookies on this site, and reloads the page so no tag code keeps running.
import { tracking } from "../site.ts";

type Item = { id: string; name?: string | undefined; price?: number | undefined; quantity?: number | undefined };
export type TrackEvent =
  | { type: "view_item"; item: Item }
  | { type: "add_to_cart"; item: Item }
  | { type: "begin_checkout"; value: number; items: Item[] }
  | { type: "purchase"; orderId: string; value: number; items: Item[] };

export type Choice = "granted" | "denied";
const CONSENT_KEY = "vicuna-consent";
type W = Window & Record<string, unknown>;
const w = (): W => window as unknown as W;

/** First-party cookies the tags set on this site: GA4 (_ga, _ga_<id>), Meta (_fbp, _fbc), Snap (_scid*, _sctr), TikTok (_ttp). */
export const TRACKING_COOKIE = /^(?:_ga(?:_|$)|_gid$|_gat|_gcl_|_fbp$|_fbc$|_scid|_sctr$|_ttp$)/;

/** The choice made on this page when the browser blocks storage (it then lasts for this page only). */
let pageChoice: Choice | null = null;
let loaded = false;
let revoked = false;

export function consent(): Choice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    /* storage blocked */
  }
  return pageChoice;
}

export function setConsent(v: Choice): void {
  const wasLoaded = loaded;
  pageChoice = v;
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  if (v === "granted") {
    load();
    return;
  }
  clearTrackingCookies();
  if (wasLoaded) {
    revoke();
    // The vendors' scripts can still run their own automatic events on this page; reloading ends them.
    w().location.reload();
  }
}

function script(src: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.append(s);
}

function load(): void {
  if (loaded || revoked) return;
  loaded = true;
  const win = w();
  if (tracking.ga4) {
    win["dataLayer"] = (win["dataLayer"] as unknown[]) ?? [];
    const gtag = function (...args: unknown[]) {
      (win["dataLayer"] as unknown[]).push(args);
    };
    win["gtag"] = gtag;
    win[`ga-disable-${tracking.ga4}`] = false;
    // Google consent mode: the visitor accepted, so storage is granted from the first hit.
    gtag("consent", "default", { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
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
    win["fbq"] = fbq;
    win["_fbq"] = fbq;
    script("https://connect.facebook.net/en_US/fbevents.js");
    call("fbq", "consent", "grant");
    call("fbq", "init", tracking.meta);
    call("fbq", "track", "PageView");
  }
  if (tracking.tiktok) {
    const q: unknown[] = [];
    const ttq: Record<string, unknown> = { _q: q };
    for (const m of ["page", "track", "identify", "load", "grantConsent", "revokeConsent"]) ttq[m] = (...a: unknown[]) => q.push([m, ...a]);
    win["ttq"] = ttq;
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
    win["snaptr"] = snaptr;
    script("https://sc-static.net/scevent.min.js");
    call("snaptr", "init", tracking.snapchat);
    call("snaptr", "track", "PAGE_VIEW");
  }
}

/** Tells each loaded tag to stop, using the vendor's documented switch. Snap has none: the page reload stops it. */
function revoke(): void {
  revoked = true;
  if (tracking.ga4) {
    call("gtag", "consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    w()[`ga-disable-${tracking.ga4}`] = true;
  }
  if (tracking.meta) call("fbq", "consent", "revoke");
  if (tracking.tiktok) call("ttq", "revokeConsent");
}

/**
 * Deletes the tags' first-party cookies (and same-named local storage) on this site, for every domain level they may
 * have been set on (e.g. staging.vicuna-eg.com and .vicuna-eg.com). Cookies the vendors set on their own domains
 * (facebook.com, google.com, snapchat.com) cannot be deleted from here.
 */
export function clearTrackingCookies(doc: Pick<Document, "cookie"> = document, host: string = location.hostname): string[] {
  const names = doc.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim() ?? "")
    .filter((n) => TRACKING_COOKIE.test(n));
  const labels = host.split(".");
  const domains: string[] = [""];
  for (let i = 0; i < labels.length - 1; i++) {
    const d = labels.slice(i).join(".");
    domains.push(d, `.${d}`);
  }
  for (const name of new Set(names)) {
    for (const d of domains) doc.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && TRACKING_COOKIE.test(k)) localStorage.removeItem(k);
    }
  } catch {
    /* storage blocked: nothing stored */
  }
  return [...new Set(names)];
}

function call(name: string, ...args: unknown[]): void {
  const fn = w()[name];
  if (typeof fn === "function") (fn as (...a: unknown[]) => void)(...args);
}

const egp = (piasters: number) => piasters / 100;

function send(e: TrackEvent): void {
  switch (e.type) {
    case "view_item": {
      const v = egp(e.item.price ?? 0);
      call("gtag", "event", "view_item", { currency: "EGP", value: v, items: [{ item_id: e.item.id, item_name: e.item.name, price: v }] });
      call("fbq", "track", "ViewContent", { content_ids: [e.item.id], content_type: "product", value: v, currency: "EGP" });
      call("ttq", "track", "ViewContent", { content_id: e.item.id, content_type: "product", value: v, currency: "EGP" });
      call("snaptr", "track", "VIEW_CONTENT", { item_ids: [e.item.id], price: v, currency: "EGP" });
      break;
    }
    case "add_to_cart": {
      const v = egp(e.item.price ?? 0);
      call("gtag", "event", "add_to_cart", { currency: "EGP", value: v, items: [{ item_id: e.item.id, item_name: e.item.name, price: v, quantity: 1 }] });
      call("fbq", "track", "AddToCart", { content_ids: [e.item.id], content_type: "product", value: v, currency: "EGP" });
      call("ttq", "track", "AddToCart", { content_id: e.item.id, content_type: "product", value: v, currency: "EGP" });
      call("snaptr", "track", "ADD_CART", { item_ids: [e.item.id], price: v, currency: "EGP" });
      break;
    }
    case "begin_checkout":
    case "purchase": {
      const v = egp(e.value);
      const ids = e.items.map((i) => i.id);
      const count = e.items.reduce((n, i) => n + (i.quantity ?? 1), 0);
      const gaItems = e.items.map((i) => ({ item_id: i.id, ...(i.name ? { item_name: i.name } : {}), ...(i.price !== undefined ? { price: egp(i.price) } : {}), quantity: i.quantity ?? 1 }));
      const contents = e.items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, ...(i.price !== undefined ? { item_price: egp(i.price) } : {}) }));
      if (e.type === "begin_checkout") {
        call("gtag", "event", "begin_checkout", { currency: "EGP", value: v, items: gaItems });
        call("fbq", "track", "InitiateCheckout", { content_ids: ids, contents, content_type: "product", value: v, currency: "EGP", num_items: count });
        call("ttq", "track", "InitiateCheckout", { contents: contents.map((c) => ({ content_id: c.id, quantity: c.quantity })), content_type: "product", value: v, currency: "EGP" });
        call("snaptr", "track", "START_CHECKOUT", { item_ids: ids, number_items: count, price: v, currency: "EGP" });
      } else {
        call("gtag", "event", "purchase", { transaction_id: e.orderId, currency: "EGP", value: v, items: gaItems });
        call("fbq", "track", "Purchase", { content_ids: ids, contents, content_type: "product", value: v, currency: "EGP", num_items: count }, { eventID: e.orderId });
        call("ttq", "track", "CompletePayment", { contents: contents.map((c) => ({ content_id: c.id, quantity: c.quantity })), content_type: "product", value: v, currency: "EGP" });
        call("snaptr", "track", "PURCHASE", { transaction_id: e.orderId, item_ids: ids, number_items: count, price: v, currency: "EGP" });
      }
      break;
    }
  }
}

/** Sends the event only if the visitor has accepted cookies; otherwise it is dropped (never kept for later). */
export function track(e: TrackEvent): boolean {
  if (revoked || consent() !== "granted") return false;
  load();
  send(e);
  return true;
}

/** Called once per page by the consent banner. */
export function initTracking(): void {
  if (consent() === "granted") load();
}
