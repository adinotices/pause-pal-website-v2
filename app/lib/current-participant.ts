import { cookies } from "next/headers";
import { PARTICIPANT_SESSION_COOKIE, verifyParticipantSession } from "./participant-auth";

/** The signed-in participant's personId, from the session cookie proxy.ts
 * already verified before this route was reached. Returns null if
 * somehow called without a valid session (defense in depth -- proxy.ts is
 * the primary gate, this shouldn't normally return null on a protected
 * route, per Next's guidance not to rely on Proxy alone). */
export async function getCurrentPersonId(): Promise<number | null> {
  const store = await cookies();
  return verifyParticipantSession(store.get(PARTICIPANT_SESSION_COOKIE)?.value);
}
