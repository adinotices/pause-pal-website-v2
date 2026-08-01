import { createHmac, timingSafeEqual } from "crypto";

export const PARTICIPANT_SESSION_COOKIE = "pausepal_participant_session";

/** Deliberately a separate secret from ADMIN_SESSION_SECRET (lib/auth.ts)
 * -- participant and admin sessions should never be interchangeable, even
 * if one secret were somehow compromised. */
function getSecret(): string {
  const secret = process.env.PARTICIPANT_SESSION_SECRET;
  if (!secret) {
    throw new Error("PARTICIPANT_SESSION_SECRET is not set. See .env.example.");
  }
  return secret;
}

function sign(personId: number): string {
  return createHmac("sha256", getSecret()).update(String(personId)).digest("hex");
}

/** Cookie value encodes *which* person is signed in (unlike the admin
 * session, which just needs "authenticated or not"), so it's
 * `${personId}.${signature}` rather than a fixed constant -- the signature
 * proves the personId wasn't tampered with client-side. */
export function signParticipantSession(personId: number): string {
  return `${personId}.${sign(personId)}`;
}

export function verifyParticipantSession(cookieValue: string | undefined): number | null {
  if (!cookieValue) return null;
  const [idPart, signaturePart] = cookieValue.split(".");
  if (!idPart || !signaturePart) return null;
  const personId = Number(idPart);
  if (!Number.isInteger(personId) || personId <= 0) return null;

  const expected = sign(personId);
  const a = Buffer.from(signaturePart);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return personId;
}
