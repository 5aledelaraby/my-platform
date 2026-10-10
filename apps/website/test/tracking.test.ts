// Consent and tracking in a small fake browser: what loads, what is sent, and what withdrawing does.
// Each "page" is a fresh copy of tracking.ts (a new module instance) on top of the same storage and cookies.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type * as TrackingModule from "../src/scripts/tracking.ts";
import { tracking } from "../src/site.ts";

type Tracking = typeof TrackingModule;
const g = globalThis as unknown as Record<string, unknown>;

interface Browser {
  store: Map<string, string>;
  cookies: Map<string, string>;
  /** Every `document.cookie = ...` assignment, as written. */
  cookieWrites: string[];
  scripts: string[];
  reloads: number;
}
let b: Browser;
let pageNo = 0;

function setGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function browser(options: { blockStorage?: boolean } = {}): Browser {
  const state: Browser = { store: new Map(), cookies: new Map(), cookieWrites: [], scripts: [], reloads: 0 };
  const blocked = () => {
    throw new Error("SecurityError: storage blocked");
  };
  const storage = options.blockStorage
    ? { getItem: blocked, setItem: blocked, removeItem: blocked, key: blocked, get length(): number { return blocked(); } }
    : {
        getItem: (k: string) => state.store.get(k) ?? null,
        setItem: (k: string, v: string) => void state.store.set(k, String(v)),
        removeItem: (k: string) => void state.store.delete(k),
        key: (i: number) => [...state.store.keys()][i] ?? null,
        get length() {
          return state.store.size;
        },
      };
  setGlobal("localStorage", storage);
  setGlobal("location", { hostname: "staging.vicuna-eg.com", reload: () => void (state.reloads += 1) });
  setGlobal("document", {
    head: { append: (s: { src: string }) => void state.scripts.push(s.src) },
    createElement: () => ({}),
    get cookie() {
      return [...state.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(v: string) {
      state.cookieWrites.push(v);
      const [pair = "", ...attrs] = v.split(";").map((x) => x.trim());
      const [name = "", value = ""] = pair.split("=");
      if (attrs.some((a) => /^max-age=0$/i.test(a))) state.cookies.delete(name);
      else state.cookies.set(name, value);
    },
  });
  setGlobal("window", globalThis);
  for (const k of ["gtag", "dataLayer", "fbq", "_fbq", "snaptr", "ttq", `ga-disable-${tracking.ga4}`]) delete g[k];
  return state;
}

/** A new page load: fresh module state, same browser storage. Tag globals from the previous page are gone. */
async function page(): Promise<Tracking> {
  for (const k of ["gtag", "dataLayer", "fbq", "_fbq", "snaptr", "ttq", `ga-disable-${tracking.ga4}`]) delete g[k];
  b.scripts.length = 0;
  pageNo += 1;
  return (await import(`../src/scripts/tracking.ts?page=${pageNo}`)) as Tracking;
}

const dataLayer = () => ((g["dataLayer"] as unknown[][] | undefined) ?? []).map((a) => [...a]);
const fbqCalls = () => ((g["fbq"] as { queue?: unknown[][] } | undefined)?.queue ?? []).map((a) => [...a]);
const snapCalls = () => ((g["snaptr"] as { queue?: unknown[][] } | undefined)?.queue ?? []).map((a) => [...a]);
const hosts = () => b.scripts.map((s) => new URL(s).host).sort();
const viewItem = { type: "view_item" as const, item: { id: "lace-gold", name: "دانتيل دهبي", price: 30000 } };

describe("tracking and consent", () => {
  beforeEach(() => {
    b = browser();
  });

  it("a new visitor: nothing loads, events are dropped (not kept for later)", async () => {
    const t = await page();
    t.initTracking();
    assert.equal(t.consent(), null);
    assert.equal(t.track(viewItem), false);
    assert.deepEqual(b.scripts, []);
    assert.deepEqual(dataLayer(), []);
    // Accepting afterwards does not send what happened before the choice.
    t.setConsent("granted");
    assert.ok(!dataLayer().some((a) => a[1] === "view_item"), "pre-consent view_item must not be sent");
    assert.ok(!fbqCalls().some((a) => a[1] === "ViewContent"));
  });

  it("accept: only the configured tags load (no TikTok without an ID), with consent granted first", async () => {
    const t = await page();
    t.setConsent("granted");
    const expected = ["connect.facebook.net", "sc-static.net", "www.googletagmanager.com"];
    if (tracking.tiktok) expected.push("analytics.tiktok.com");
    assert.deepEqual(hosts(), expected.sort());
    assert.deepEqual(dataLayer()[0]?.slice(0, 2), ["consent", "default"]);
    assert.deepEqual(fbqCalls()[0], ["consent", "grant"]);
    assert.equal(t.track(viewItem), true);
    assert.ok(dataLayer().some((a) => a[0] === "event" && a[1] === "view_item"));
  });

  it("reload and the next page after accepting: tags load at once, without the banner choice", async () => {
    (await page()).setConsent("granted");
    const next = await page();
    next.initTracking();
    assert.equal(next.consent(), "granted");
    assert.ok(hosts().includes("www.googletagmanager.com"));
    assert.equal(next.track({ type: "add_to_cart", item: { id: "wide-tie-gold", price: 20000 } }), true);
  });

  it("reject: nothing loads now or on the next page, and the page does not reload", async () => {
    const t = await page();
    t.setConsent("denied");
    assert.equal(b.reloads, 0);
    assert.deepEqual(b.scripts, []);
    const next = await page();
    next.initTracking();
    assert.equal(next.track(viewItem), false);
    assert.deepEqual(b.scripts, []);
  });

  it("withdrawing after accepting: each vendor is told to stop, cookies go, the page reloads, nothing more is sent", async () => {
    const t = await page();
    t.setConsent("granted");
    for (const c of ["_ga", "_ga_PD8H3JF2WR", "_fbp", "_fbc", "_scid", "_sctr", "vicuna-other"]) b.cookies.set(c, "x");
    b.store.set("_scid", "x");
    t.setConsent("denied");
    // Google: consent mode update + the documented opt-out flag.
    assert.ok(dataLayer().some((a) => a[0] === "consent" && a[1] === "update" && (a[2] as Record<string, string>)["analytics_storage"] === "denied"));
    assert.equal(g[`ga-disable-${tracking.ga4}`], true);
    // Meta: documented consent revoke.
    assert.ok(fbqCalls().some((a) => a[0] === "consent" && a[1] === "revoke"));
    // Snap has no documented switch: the reload stops it.
    assert.equal(b.reloads, 1);
    assert.deepEqual([...b.cookies.keys()], ["vicuna-other"]);
    assert.equal(b.store.has("_scid"), false);
    assert.equal(b.store.get("vicuna-consent"), "denied");
    // Until the reload happens, nothing else is sent.
    const before = [dataLayer().length, fbqCalls().length, snapCalls().length];
    assert.equal(t.track({ type: "add_to_cart", item: { id: "lace-gold", price: 30000 } }), false);
    assert.deepEqual([dataLayer().length, fbqCalls().length, snapCalls().length], before);
    // After the reload: nothing loads.
    const next = await page();
    next.initTracking();
    assert.deepEqual(b.scripts, []);
  });

  it("cookies are deleted on every domain level they may have been set on", async () => {
    const t = await page();
    b.cookies.set("_ga", "x");
    t.clearTrackingCookies();
    for (const d of ["", "; Domain=vicuna-eg.com", "; Domain=.vicuna-eg.com", "; Domain=staging.vicuna-eg.com"]) {
      assert.ok(b.cookieWrites.includes(`_ga=; Max-Age=0; Path=/${d}`), `missing delete for ${d || "host only"}`);
    }
  });

  it("blocked storage: the choice works for the page, then the next page asks again and loads nothing", async () => {
    b = browser({ blockStorage: true });
    const t = await page();
    t.initTracking();
    assert.equal(t.consent(), null);
    assert.equal(t.track(viewItem), false);
    t.setConsent("granted");
    assert.equal(t.consent(), "granted");
    assert.ok(hosts().includes("www.googletagmanager.com"));
    const next = await page();
    next.initTracking();
    assert.equal(next.consent(), null);
    assert.deepEqual(b.scripts, []);
  });

  it("purchase sends the product ids (the catalogue SKUs) to every vendor, and no personal data", async () => {
    const t = await page();
    t.setConsent("granted");
    const items = [{ id: "wide-tie-gold", quantity: 2, price: 20000 }, { id: "lace-black", quantity: 1, price: 30000 }];
    t.track({ type: "purchase", orderId: "V-1010-ABCDE", value: 78000, items });
    const ga = dataLayer().find((a) => a[1] === "purchase")?.[2] as { items: Array<{ item_id: string; quantity: number; price: number }>; value: number };
    assert.deepEqual(ga.items.map((i) => [i.item_id, i.quantity, i.price]), [["wide-tie-gold", 2, 200], ["lace-black", 1, 300]]);
    assert.equal(ga.value, 780);
    const fb = fbqCalls().find((a) => a[1] === "Purchase");
    assert.deepEqual((fb?.[2] as { content_ids: string[] }).content_ids, ["wide-tie-gold", "lace-black"]);
    assert.equal((fb?.[2] as { num_items: number }).num_items, 3);
    assert.deepEqual(fb?.[3], { eventID: "V-1010-ABCDE" });
    const snap = snapCalls().find((a) => a[1] === "PURCHASE")?.[2] as { item_ids: string[]; number_items: number };
    assert.deepEqual(snap.item_ids, ["wide-tie-gold", "lace-black"]);
    assert.equal(snap.number_items, 3);
    const all = JSON.stringify([dataLayer(), fbqCalls(), snapCalls()]);
    assert.doesNotMatch(all, /customer|phone|address|01[0125]\d{8}/i);
  });
});
