import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifySession } from "./auth";

/**
 * Explicit authorization check for admin Server Actions. proxy.ts already
 * gates every /admin/* page, but Server Actions are POSTs to whatever page
 * they're defined on and aren't guaranteed to inherit that protection in
 * every configuration -- Next's own guidance is not to rely on Proxy
 * alone (see the Data Security guide). Not currently exploitable here
 * (verified: a real action ID only resolves on the page it's bound to,
 * and every admin action's page is itself proxy-gated), but this is the
 * cheap, correct defense-in-depth regardless. Redirects rather than
 * throwing so an expired session mid-form-submission lands back at login
 * instead of a raw error screen.
 */
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const authed = verifySession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!authed) {
    redirect("/admin/login");
  }
}
