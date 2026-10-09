import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, buildOrder, catalog, lookupProduct, validateOrderRequest } from "@platform/commerce";
import { ADMIN_HEADER, accessVerifier, createAdminHandler, createHandler, d1Repository, teamIssuer, unverifiedAccessHints } from "../src/index.ts";
import type { AdminVerifier } from "../src/index.ts";
import { sqliteD1 } from "./sqlite-d1.ts";

const NOW = new Date("2026-10-09T10:00:00Z");
const ISSUER = "https://vicuna.cloudflareaccess.com";
const AUD = "aud-tag-123";
const OWNER = "owner@example.com";

// ---------------------------------------------------------------- JWT helpers (a fake Access team)
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const enc = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

// Each fake team has its own issuer: the verifier caches signing keys per issuer for the Worker's lifetime.
async function team(kid = "k1") {
  const teamDomain = `t-${kid}`;
  const issuer = `https://t-${kid}.cloudflareaccess.com`;
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid };
  let certFetches = 0;
  const fetchImpl = ((url: string | URL | Request) => {
    certFetches += 1;
    assert.equal(String(url), `${issuer}/cdn-cgi/access/certs`);
    return Promise.resolve(new Response(JSON.stringify({ keys: [jwk] })));
  }) as typeof fetch;
  async function token(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
    const h = enc({ alg: "RS256", kid, typ: "JWT", ...header });
    const p = enc({ iss: issuer, aud: [AUD], email: OWNER, exp: Math.floor(NOW.getTime() / 1000) + 3600, ...claims });
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${h}.${p}`)));
    return `${h}.${p}.${b64url(sig)}`;
  }
  return { fetchImpl, token, fetches: () => certFetches, teamDomain, issuer };
}

const withJwt = (jwt: string) => new Request("https://staging.vicuna-eg.com/api/admin/", { headers: { "Cf-Access-Jwt-Assertion": jwt } });

describe("teamIssuer", () => {
  it("accepts a team name, a domain or a URL", () => {
    assert.equal(teamIssuer("vicuna"), ISSUER);
    assert.equal(teamIssuer("vicuna.cloudflareaccess.com"), ISSUER);
    assert.equal(teamIssuer("https://vicuna.cloudflareaccess.com/"), ISSUER);
  });
});

describe("accessVerifier", () => {
  it("accepts a valid token for an allowed email (case-insensitive)", async () => {
    const t = await team("kid-valid");
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: ["Owner@Example.com"], fetchImpl: t.fetchImpl, now: () => NOW.getTime() });
    assert.equal(await verify(withJwt(await t.token({}))), OWNER);
  });

  it("rejects a missing, malformed, tampered or wrongly signed token", async () => {
    const t = await team("kid-bad");
    const other = await team("kid-bad"); // same kid, different key
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [OWNER], fetchImpl: t.fetchImpl, now: () => NOW.getTime() });
    assert.equal(await verify(new Request("https://x/")), null);
    assert.equal(await verify(withJwt("a.b")), null);
    assert.equal(await verify(withJwt("not.a.jwt")), null);
    const good = await t.token({});
    const [h, , s] = good.split(".");
    const forged = `${h}.${enc({ iss: t.issuer, aud: [AUD], email: "attacker@example.com", exp: 9_999_999_999 })}.${s}`;
    assert.equal(await verify(withJwt(forged)), null);
    assert.equal(await verify(withJwt(await other.token({}))), null);
    assert.equal(await verify(withJwt(await t.token({}, { alg: "none" }))), null);
  });

  it("rejects the wrong audience, issuer, an expired token, a future token and other emails", async () => {
    const t = await team("kid-claims");
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [OWNER], fetchImpl: t.fetchImpl, now: () => NOW.getTime() });
    const nowS = Math.floor(NOW.getTime() / 1000);
    assert.equal(await verify(withJwt(await t.token({ aud: ["someone-else"] }))), null);
    assert.equal(await verify(withJwt(await t.token({ iss: "https://evil.cloudflareaccess.com" }))), null);
    assert.equal(await verify(withJwt(await t.token({ exp: nowS - 120 }))), null);
    assert.equal(await verify(withJwt(await t.token({ nbf: nowS + 600 }))), null);
    assert.equal(await verify(withJwt(await t.token({ email: "friend@example.com" }))), null);
    assert.equal(await verify(withJwt(await t.token({ email: undefined }))), null);
  });

  it("fails closed without an audience or allowed emails", async () => {
    const t = await team("kid-config");
    const jwt = await t.token({});
    assert.equal(await accessVerifier({ teamDomain: t.teamDomain, audience: "", emails: [OWNER], fetchImpl: t.fetchImpl, now: () => NOW.getTime() })(withJwt(jwt)), null);
    assert.equal(await accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [], fetchImpl: t.fetchImpl, now: () => NOW.getTime() })(withJwt(jwt)), null);
  });

  it("caches the signing keys between requests", async () => {
    const t = await team("kid-cache");
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [OWNER], fetchImpl: t.fetchImpl, now: () => NOW.getTime() });
    const jwt = await t.token({});
    await verify(withJwt(jwt));
    await verify(withJwt(jwt));
    assert.equal(t.fetches(), 1);
  });
});

// ---------------------------------------------------------------- admin endpoints
function adminApp(verify: AdminVerifier | null = () => Promise.resolve(OWNER)) {
  const db = sqliteD1();
  const repo = d1Repository(db);
  let i = 0;
  const admin = createAdminHandler({ repository: repo, verify, now: () => NOW, randomBytes: (len) => Uint8Array.from({ length: len }, () => i++ % 256) });
  const handler = createHandler({
    lookup: lookupProduct,
    shipping: SHIPPING,
    repository: repo,
    allowedOrigins: ["https://staging.vicuna-eg.com"],
    now: () => NOW,
    randomBytes: (len) => Uint8Array.from({ length: len }, () => i++ % 256),
    admin,
    adminHost: ADMIN_HOST,
  });
  return { handler, repo };
}

const ADMIN_HOST = "admin.vicuna-eg.com";
const BASE = `https://${ADMIN_HOST}`;
const get = (path: string) => new Request(`${BASE}${path}`);
const send = (method: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", [ADMIN_HEADER]: "1", Origin: BASE, ...headers },
    body: JSON.stringify(body),
  });

async function placeOrder(repo: ReturnType<typeof d1Repository>, id: string, items: Array<{ id: string; quantity: number }>) {
  const r = validateOrderRequest(
    { items, customer: { name: "منى <img src=x onerror=alert(1)>", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" } },
    lookupProduct,
  );
  if (!r.ok) throw new Error("invalid");
  const order = buildOrder(r.value, lookupProduct, SHIPPING, { id, now: NOW });
  assert.equal(await repo.insert(order), "ok");
  return order;
}

describe("admin access", () => {
  it("is closed (503) until Access is configured", async () => {
    const { handler } = adminApp(null);
    assert.equal((await handler(get("/"))).status, 503);
    assert.equal((await handler(get("/api/orders"))).status, 503);
  });

  it("names the missing settings (names only) on the not-configured page", async () => {
    const admin = createAdminHandler({
      repository: d1Repository(sqliteD1()),
      verify: null,
      missingSettings: ["ACCESS_AUD", "<script>"],
      now: () => NOW,
      randomBytes: (len) => new Uint8Array(len),
    });
    const html = await (await admin(get("/"), "/admin")).text();
    assert.match(html, /ACCESS_AUD/);
    assert.doesNotMatch(html, /ADMIN_EMAILS|ACCESS_TEAM_DOMAIN|<script>/);
    assert.match(html, /Additional settings/);
    assert.doesNotMatch(html, /<textarea/);
  });

  // The owner is already signed in through Access, so the (unverified) token shows the values to paste.
  const unsigned = (claims: Record<string, unknown>) => `${enc({ alg: "RS256", kid: "x" })}.${enc(claims)}.sig`;
  const REAL_AUD = "4714c1358e65fe4b408ad6d432a5f878f08194bdb4752441fd56faefa9b2b6f2";
  const notConfigured = (missing: string[]) =>
    createAdminHandler({ repository: d1Repository(sqliteD1()), verify: null, missingSettings: missing, now: () => NOW, randomBytes: (len) => new Uint8Array(len) });
  const pageWith = async (missing: string[], jwt: string) =>
    (await notConfigured(missing)(new Request("https://admin.vicuna-eg.com/", { headers: { "Cf-Access-Jwt-Assertion": jwt } }), "/admin")).text();

  it("shows the values from the owner's own sign-in, for missing settings only", async () => {
    const jwt = unsigned({ iss: "https://wild-river-9c99.cloudflareaccess.com", aud: [REAL_AUD], email: "Owner@Example.com" });
    const all = await pageWith(["ACCESS_TEAM_DOMAIN", "ACCESS_AUD", "ADMIN_EMAILS"], jwt);
    assert.match(all, />wild-river-9c99<\/textarea>/);
    assert.match(all, new RegExp(`>${REAL_AUD}</textarea>`));
    assert.match(all, />owner@example\.com<\/textarea>/);
    const audOnly = await pageWith(["ACCESS_AUD"], jwt);
    assert.match(audOnly, new RegExp(REAL_AUD));
    assert.doesNotMatch(audOnly, /wild-river|owner@/);
  });

  it("drops token values that do not look right instead of echoing them", async () => {
    const jwt = unsigned({ iss: "https://evil.example/", aud: ["<script>alert(1)</script>"], email: "a<b>@x.com" });
    const html = await pageWith(["ACCESS_TEAM_DOMAIN", "ACCESS_AUD", "ADMIN_EMAILS"], jwt);
    assert.doesNotMatch(html, /<textarea|<script>|evil|a<b>/);
    assert.deepEqual(unverifiedAccessHints(new Request("https://a.example/", { headers: { "Cf-Access-Jwt-Assertion": unsigned({ aud: [REAL_AUD, REAL_AUD] }) } })), {});
    assert.deepEqual(unverifiedAccessHints(new Request("https://a.example/", { headers: { "Cf-Access-Jwt-Assertion": "not-a-jwt" } })), {});
    assert.deepEqual(unverifiedAccessHints(new Request("https://a.example/")), {});
  });

  it("never lets an unverified token into the admin once it is configured", async () => {
    const verify = accessVerifier({ teamDomain: "wild-river-9c99", audience: REAL_AUD, emails: ["owner@example.com"], fetchImpl: (() => Promise.resolve(new Response(JSON.stringify({ keys: [] })))) as typeof fetch, now: () => NOW.getTime() });
    const jwt = unsigned({ iss: "https://wild-river-9c99.cloudflareaccess.com", aud: [REAL_AUD], email: "owner@example.com", exp: Math.floor(NOW.getTime() / 1000) + 60 });
    const admin = createAdminHandler({ repository: d1Repository(sqliteD1()), verify, now: () => NOW, randomBytes: (len) => new Uint8Array(len) });
    const res = await admin(new Request("https://admin.vicuna-eg.com/", { headers: { "Cf-Access-Jwt-Assertion": jwt } }), "/admin");
    assert.equal(res.status, 403);
  });

  it("refuses everything without a verified owner", async () => {
    const { handler } = adminApp(() => Promise.resolve(null));
    for (const req of [get("/"), get("/app.js"), get("/api/orders"), get("/api/stock"), send("PUT", "/api/stock/bow-gold", { quantity: 1, expected: null })]) {
      assert.equal((await handler(req)).status, 403, req.url);
    }
  });

  it("serves the page with a strict CSP and no caching", async () => {
    const { handler } = adminApp();
    const res = await handler(get("/"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Content-Type") ?? "", /text\/html/);
    assert.match(res.headers.get("Content-Security-Policy") ?? "", /script-src 'self'/);
    assert.match(res.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.match(await res.text(), /src="\/app\.js"/);
    assert.equal((await handler(get("/app.js"))).headers.get("Content-Type"), "text/javascript; charset=utf-8");
  });

  it("blocks cross-site changes: custom header and same origin are required", async () => {
    const { handler } = adminApp();
    assert.equal((await handler(send("PUT", "/api/stock/bow-gold", { quantity: 1, expected: null }, { [ADMIN_HEADER]: "" }))).status, 403);
    assert.equal((await handler(send("PUT", "/api/stock/bow-gold", { quantity: 1, expected: null }, { Origin: "https://evil.example" }))).status, 403);
    assert.equal((await handler(send("PUT", "/api/stock/bow-gold", { quantity: 1, expected: null }, { "Content-Type": "text/plain" }))).status, 415);
  });
});

describe("admin orders", () => {
  it("lists and shows orders, raw customer text included (the page renders it as text)", async () => {
    const { handler, repo } = adminApp();
    await placeOrder(repo, "V-1009-AAAA1", [{ id: "bow-gold", quantity: 1 }]);
    const list = (await (await handler(get("/api/orders"))).json()) as { orders: Array<{ id: string; customerName: string }> };
    assert.deepEqual(list.orders.map((o) => o.id), ["V-1009-AAAA1"]);
    const one = (await (await handler(get("/api/orders/V-1009-AAAA1"))).json()) as { order: { id: string }; next: string[] };
    assert.equal(one.order.id, "V-1009-AAAA1");
    assert.deepEqual(one.next, ["confirmed", "cancelled"]);
    assert.equal((await handler(get("/api/orders/V-1009-NONE0"))).status, 404);
    assert.equal((await handler(get("/api/orders?status=bogus"))).status, 400);
  });

  it("changes status step by step, refuses skips, stale versions and changes after cancel", async () => {
    const { handler, repo } = adminApp();
    await repo.setStock("lace-black", 3, null, NOW.toISOString());
    await placeOrder(repo, "V-1009-AAAA2", [{ id: "lace-black", quantity: 2 }]);
    const move = (to: string, version: number) => handler(send("POST", "/api/orders/V-1009-AAAA2/status", { to, version }));

    assert.equal((await move("delivered", 0)).status, 409, "cannot skip to delivered");
    const confirmed = await move("confirmed", 0);
    assert.equal(confirmed.status, 200);
    assert.equal(((await confirmed.json()) as { order: { status: string; version: number } }).order.version, 1);
    assert.equal((await move("shipped", 0)).status, 409, "stale version");
    assert.equal((await move("cancelled", 1)).status, 200);
    assert.deepEqual([...(await repo.stock())], [["lace-black", 3]], "stock returned");
    assert.equal((await move("confirmed", 2)).status, 409, "cancelled is final");
    assert.equal((await move("cancelled", 2)).status, 409, "no double cancel");
    assert.deepEqual([...(await repo.stock())], [["lace-black", 3]], "still returned only once");
    assert.equal((await handler(send("POST", "/api/orders/V-1009-AAAA2/status", { to: "lost", version: 2 }))).status, 400);
  });

  it("tells the owner about each real status change, in the background", async () => {
    const repo = d1Repository(sqliteD1());
    const sent: string[] = [];
    const work: Array<Promise<unknown>> = [];
    const errors: string[] = [];
    let fail = false;
    const admin = createAdminHandler({
      repository: repo,
      verify: () => Promise.resolve(OWNER),
      now: () => NOW,
      randomBytes: (len) => crypto.getRandomValues(new Uint8Array(len)),
      reportError: (label) => errors.push(label),
      notifyStatus: (o, from, to) => (fail ? Promise.reject(new Error("telegram_http_500")) : (sent.push(`${o.id} ${from}>${to} ${o.customer.phone}`), Promise.resolve())),
      waitUntil: (w) => work.push(w),
    });
    await placeOrder(repo, "V-1009-BBBB3", [{ id: "bow-gold", quantity: 1 }]);
    const move = (to: string, version: number) => admin(send("POST", "/api/orders/V-1009-BBBB3/status", { to, version }), "/admin/api/orders/V-1009-BBBB3/status");

    assert.equal((await move("confirmed", 0)).status, 200);
    assert.equal((await move("shipped", 0)).status, 409, "stale: no message");
    assert.equal((await move("delivered", 1)).status, 409, "skip: no message");
    await Promise.all(work);
    assert.deepEqual(sent, ["V-1009-BBBB3 new>confirmed 01012345678"]);

    fail = true;
    assert.equal((await move("cancelled", 1)).status, 200, "a failed message never fails the change");
    await Promise.all(work);
    assert.deepEqual(errors, ["notify_failed:Error"]);
  });
});

describe("admin stock", () => {
  it("lists every catalogue product with its stock (null = untracked)", async () => {
    const { handler, repo } = adminApp();
    await repo.setStock("bow-gold", 4, null, NOW.toISOString());
    const data = (await (await handler(get("/api/stock"))).json()) as { products: Array<{ id: string; quantity: number | null; name: string }> };
    assert.equal(data.products.length, catalog.products.length);
    assert.equal(data.products.find((p) => p.id === "bow-gold")?.quantity, 4);
    assert.equal(data.products.find((p) => p.id === "lace-black")?.quantity, null);
  });

  it("sets, clears and validates quantities against the value the owner saw", async () => {
    const { handler, repo } = adminApp();
    const put = (body: unknown, id = "bow-gold") => handler(send("PUT", `/api/stock/${id}`, body));
    assert.equal((await put({ quantity: 6, expected: null })).status, 200);
    assert.deepEqual([...(await repo.stock())], [["bow-gold", 6]]);
    assert.equal((await put({ quantity: 9, expected: 6 })).status, 200);
    assert.equal((await put({ quantity: null, expected: 9 })).status, 200);
    assert.equal((await repo.stock()).size, 0);
    for (const quantity of [-1, 1.5, "3", 100_001]) {
      assert.equal((await put({ quantity, expected: null })).status, 400, String(quantity));
    }
    assert.equal((await put({ quantity: 1 })).status, 400, "expected is required");
    assert.equal((await put({ quantity: 1, expected: null }, "fendi-ff")).status, 404);
  });

  it("refuses to overwrite stock that an order changed meanwhile (no lost update)", async () => {
    const { handler, repo } = adminApp();
    await handler(send("PUT", "/api/stock/lace-black", { quantity: 3, expected: null }));
    await placeOrder(repo, "V-1009-LOST1", [{ id: "lace-black", quantity: 1 }]); // a customer buys one: 2 left
    const res = await handler(send("PUT", "/api/stock/lace-black", { quantity: 8, expected: 3 })); // owner typed 3 + 5
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "stale", current: 2 });
    assert.deepEqual([...(await repo.stock())], [["lace-black", 2]]);
  });

  it("shows units held by open orders, and releases them when the order ships or is cancelled", async () => {
    const { handler, repo } = adminApp();
    await handler(send("PUT", "/api/stock/croc-black", { quantity: 5, expected: null }));
    await placeOrder(repo, "V-1009-RES01", [{ id: "croc-black", quantity: 2 }]);
    const read = async () =>
      ((await (await handler(get("/api/stock"))).json()) as { products: Array<{ id: string; quantity: number | null; reserved: number }> }).products.find(
        (p) => p.id === "croc-black",
      );
    assert.deepEqual(await read(), { id: "croc-black", name: "كروكو أسود", style: "croc", styleName: "كروكو", quantity: 3, reserved: 2 });
    await handler(send("POST", "/api/orders/V-1009-RES01/status", { to: "confirmed", version: 0 }));
    assert.equal((await read())?.reserved, 2);
    await handler(send("POST", "/api/orders/V-1009-RES01/status", { to: "shipped", version: 1 }));
    assert.equal((await read())?.reserved, 0);
  });
});

describe("admin only on its own hostname, with the real verifier", () => {
  it("the store host never serves admin paths, the admin host needs a valid Access token", async () => {
    const t = await team("kid-e2e");
    const db = sqliteD1();
    const repo = d1Repository(db);
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [OWNER], fetchImpl: t.fetchImpl, now: () => NOW.getTime() });
    const admin = createAdminHandler({ repository: repo, verify, now: () => NOW, randomBytes: (len) => new Uint8Array(len) });
    const handler = createHandler({
      lookup: lookupProduct, shipping: SHIPPING, repository: repo, allowedOrigins: ["https://staging.vicuna-eg.com"],
      now: () => NOW, randomBytes: (len) => new Uint8Array(len), admin, adminHost: ADMIN_HOST,
    });
    const jwt = await t.token({});
    // Store host: admin paths do not exist there, even with a valid token.
    for (const path of ["/api/admin", "/api/admin/", "/api/admin/api/orders", "/admin/api/orders"]) {
      const res = await handler(new Request(`https://staging.vicuna-eg.com${path}`, { headers: { "Cf-Access-Jwt-Assertion": jwt } }));
      assert.equal(res.status, 404, path);
    }
    // Admin host: token required.
    assert.equal((await handler(new Request(`${BASE}/api/orders`))).status, 403);
    assert.equal((await handler(new Request(`${BASE}/api/orders`, { headers: { "Cf-Access-Jwt-Assertion": jwt } }))).status, 200);
    // Public routes are not served on the admin host.
    assert.equal((await handler(new Request(`${BASE}/orders`, { method: "POST", headers: { "Cf-Access-Jwt-Assertion": jwt } }))).status, 404);
  });
});

describe("Access verifier robustness", () => {
  it("lower-cases the team name", () => {
    assert.equal(teamIssuer("Vicuna"), ISSUER);
  });

  it("skips keys it cannot use instead of locking the owner out", async () => {
    const t = await team("kid-mixed");
    const mixed = (async (url: string | URL | Request) => {
      const real = await (await t.fetchImpl(url)).json() as { keys: object[] };
      const junk = [{ kty: "RSA", kid: "enc-key", use: "enc", n: "AQAB", e: "AQAB" }, { kty: "RSA", kid: "rs512", alg: "RS512", n: "AQAB", e: "AQAB" }, { kty: "RSA", kid: "broken", n: "!!", e: "AQAB" }];
      return new Response(JSON.stringify({ keys: [...junk, ...real.keys] }));
    }) as typeof fetch;
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [OWNER], fetchImpl: mixed, now: () => NOW.getTime() });
    assert.equal(await verify(withJwt(await t.token({}))), OWNER);
  });

  it("refetches the keys for an unknown key id at most once a minute", async () => {
    const t = await team("kid-throttle");
    let clock = NOW.getTime();
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: [OWNER], fetchImpl: t.fetchImpl, now: () => clock });
    await verify(withJwt(await t.token({})));
    for (let i = 0; i < 5; i++) await verify(withJwt(await t.token({}, { kid: `made-up-${i}` })));
    assert.equal(t.fetches(), 1);
    clock += 61_000;
    await verify(withJwt(await t.token({}, { kid: "made-up-later" })));
    assert.equal(t.fetches(), 2);
  });

  it("rejects non-ASCII look-alike emails", async () => {
    const t = await team("kid-unicode");
    const verify = accessVerifier({ teamDomain: t.teamDomain, audience: AUD, emails: ["khaled@example.com"], fetchImpl: t.fetchImpl, now: () => NOW.getTime() });
    assert.equal(await verify(withJwt(await t.token({ email: "Khaled@example.com" }))), null);
    assert.equal(await verify(withJwt(await t.token({ email: "Khaled@Example.com" }))), "khaled@example.com");
  });
});
