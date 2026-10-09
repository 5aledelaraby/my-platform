// Owner sign-in for /admin, checked inside the Worker.
//
// Cloudflare Access sits in front of the admin host and, after the owner signs in, adds a signed JWT to each
// request (Cf-Access-Jwt-Assertion). We verify that JWT here as well, so the admin stays closed even if a request
// ever reaches the Worker without passing through Access (another route, a misconfigured Access app). No valid
// token, no admin.

export type AdminVerifier = (request: Request) => Promise<string | null>;

export interface AccessConfig {
  /** Zero Trust team name ("vicuna") or domain ("vicuna.cloudflareaccess.com"). */
  teamDomain: string;
  /** The Access application's "Application Audience (AUD) Tag". */
  audience: string;
  /** Emails allowed in, compared case-insensitively. Access decides who can sign in; this is a second gate. */
  emails: readonly string[];
  fetchImpl?: typeof fetch;
  /** Milliseconds since epoch (tests). */
  now?: () => number;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}
interface JwtPayload {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  email?: string;
}

const CERTS_TTL_MS = 60 * 60 * 1000;
/** An unknown key id triggers at most one refetch per minute (tokens with made-up ids cannot flood the certs URL). */
const MIN_REFETCH_MS = 60 * 1000;
const CLOCK_SKEW_S = 60;

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A public RSA key as published by Access (JWK). */
interface Jwk {
  kty?: string;
  kid?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

/** WebCrypto key type, named without relying on a global `CryptoKey` (not declared by every @types/node). */
type VerifyKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

/** Signing keys per team, shared by all requests in this Worker instance (refreshed hourly or on a new key id). */
const certCache = new Map<string, { keys: Map<string, VerifyKey>; fetchedAt: number }>();

function decodeJson<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as T;
  } catch {
    return null;
  }
}

/** Values read from the incoming Access token WITHOUT verifying it. Display-only. */
export interface AccessHints {
  team?: string;
  aud?: string;
  email?: string;
}

/**
 * Reads the team, audience and email from the Access token without checking its signature. The only use is the
 * "admin not configured" page: Access has already signed the owner in, so the token holds exactly the values the
 * owner must paste into the dashboard. Never use the result to allow anything. Each value must match a strict
 * format or it is dropped, and the page escapes it as well.
 */
export function unverifiedAccessHints(request: Request): AccessHints {
  const parts = (request.headers.get("Cf-Access-Jwt-Assertion") ?? "").split(".");
  if (parts.length !== 3) return {};
  const payload = decodeJson<JwtPayload>(parts[1] ?? "");
  if (!payload || typeof payload !== "object") return {};
  const hints: AccessHints = {};
  const iss = typeof payload.iss === "string" ? /^https:\/\/([a-z0-9-]{1,63})\.cloudflareaccess\.com$/.exec(payload.iss) : null;
  if (iss?.[1]) hints.team = iss[1];
  // A token for one self-hosted app carries one audience; with several we cannot tell which one to show.
  const aud = Array.isArray(payload.aud) ? (payload.aud.length === 1 ? payload.aud[0] : undefined) : payload.aud;
  if (typeof aud === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(aud)) hints.aud = aud;
  const email = payload.email;
  if (typeof email === "string" && email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email)) {
    hints.email = email.toLowerCase();
  }
  return hints;
}

export function teamIssuer(teamDomain: string): string {
  const host = teamDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://${host.includes(".") ? host : `${host}.cloudflareaccess.com`}`;
}

export function accessVerifier(config: AccessConfig): AdminVerifier {
  const issuer = teamIssuer(config.teamDomain);
  const audience = config.audience.trim();
  const allowed = new Set(config.emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const fetchImpl = config.fetchImpl ?? fetch;
  const now = config.now ?? Date.now;
  async function key(kid: string): Promise<VerifyKey | undefined> {
    const cached = certCache.get(issuer);
    const expired = !cached || now() - cached.fetchedAt > CERTS_TTL_MS;
    const unknownKid = !!cached && !cached.keys.has(kid) && now() - cached.fetchedAt > MIN_REFETCH_MS;
    if (expired || unknownKid) {
      const res = await fetchImpl(`${issuer}/cdn-cgi/access/certs`);
      if (!res.ok) return cached?.keys.get(kid);
      const body = (await res.json()) as { keys?: Jwk[] };
      const keys = new Map<string, VerifyKey>();
      for (const jwk of body.keys ?? []) {
        if (!jwk.kid || jwk.kty !== "RSA") continue;
        if (jwk.alg !== undefined && jwk.alg !== "RS256") continue;
        if (jwk.use !== undefined && jwk.use !== "sig") continue;
        try {
          // The JWK shape is checked above; the cast only bridges Node's and the Workers' WebCrypto typings.
          const imported = await crypto.subtle.importKey("jwk", jwk as never, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
          keys.set(jwk.kid, imported);
        } catch {
          // One unusable key must not lock the owner out: skip it.
        }
      }
      certCache.set(issuer, { keys, fetchedAt: now() });
      return keys.get(kid);
    }
    return cached?.keys.get(kid);
  }

  return async (request) => {
    if (!audience || allowed.size === 0) return null;
    const token = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts as [string, string, string];
    const header = decodeJson<JwtHeader>(h);
    const payload = decodeJson<JwtPayload>(p);
    if (!header || !payload || header.alg !== "RS256" || !header.kid) return null;

    let verified = false;
    try {
      const k = await key(header.kid);
      if (!k) return null;
      verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", k, base64UrlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    } catch {
      return null;
    }
    if (!verified) return null;

    const nowS = Math.floor(now() / 1000);
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== issuer) return null;
    if (!auds.includes(audience)) return null;
    if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S < nowS) return null;
    if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_S > nowS) return null;
    const raw = payload.email?.trim() ?? "";
    // ASCII only, checked BEFORE lower-casing: Unicode case mapping turns some look-alikes (e.g. the Kelvin
    // sign) into ASCII letters, which would let a different address match an allowed one.
    if (!/^[\x21-\x7e]+$/.test(raw)) return null;
    const email = raw.toLowerCase();
    if (!allowed.has(email)) return null;
    return email;
  };
}
