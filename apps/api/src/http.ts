// Small HTTP helpers shared by the public order API and the admin API.

export const MAX_BODY_BYTES = 16 * 1024;
export const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A short, PII-free label for logs: the error name plus the kind of SQLite failure when there is one
 * (e.g. "Error:CHECK"). Never the message itself, which could one day contain request data.
 */
export function errorLabel(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  const text = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  const kind = /\b(UNIQUE|CHECK|NOT NULL|FOREIGN KEY) constraint failed\b/.exec(text)?.[1] ?? /\bSQLITE_[A-Z_]+\b/.exec(text)?.[0];
  return kind ? `${error.name}:${kind.replace(" ", "_")}` : error.name;
}

/**
 * Reads the body as UTF-8 text, but stops (and cancels the stream) as soon as it exceeds `limit` bytes,
 * so a chunked or mislabelled upload is never buffered whole in memory. Returns null when too large.
 */
export async function readBodyLimited(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
