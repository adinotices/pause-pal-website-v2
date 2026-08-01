/** The app's own canonical base URL, used to build absolute links sent in
 * email (magic links, reminders). Deliberately from a fixed env var, not
 * the incoming request's Host header -- trusting a client-supplied header
 * here would let someone get PausePal to email a real user a link pointing
 * at an attacker-controlled domain. */
export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
