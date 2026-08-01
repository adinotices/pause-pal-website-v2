import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "pausepal_admin_session";
const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set. See .env.example.");
  }
  return secret;
}

/** Phase 1 has exactly one admin (Aditya), so a single shared password
 * checked against a signed cookie is enough -- no user table, no per-user
 * sessions. Revisit if/when more than one person needs admin access. */
export function signSession(): string {
  return createHmac("sha256", getSecret()).update(SESSION_VALUE).digest("hex");
}

export function verifySession(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const expected = signSession();
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set. See .env.example.");
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
