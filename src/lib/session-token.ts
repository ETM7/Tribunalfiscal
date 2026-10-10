import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function sealSession(userId: string, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ sub: userId, exp: now + SESSION_MAX_AGE_MS }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function openSession(token: string, secret: string, now = Date.now()): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    if (typeof parsed.sub !== "string" || parsed.sub.length === 0) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}
