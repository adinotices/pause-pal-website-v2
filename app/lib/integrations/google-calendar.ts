import { createSign } from "crypto";
import { isGoogleCalendarConfigured } from "./config";

/**
 * Google Calendar via a service account (JWT Bearer flow), not a per-user
 * OAuth consent screen -- there's no human available to click through an
 * interactive consent flow for a server automation, so this app authorizes
 * as a service account and expects the target calendar to have been
 * *shared* with that service account's email (with "make changes to
 * events" permission). See app/README.md for setup. Implemented against
 * Google's documented REST API; not exercised against a live account in
 * this codebase, so treat as unverified until it's run once for real.
 */

export { isGoogleCalendarConfigured };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** Signs a Google service-account JWT assertion (RS256). Pure given its
 * inputs -- no network or env access -- so it's testable with a throwaway
 * keypair rather than real credentials. */
export function signServiceAccountJWT(
  serviceAccountEmail: string,
  privateKeyPem: string,
  scope: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccountEmail,
    scope,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

export type CalendarEventInput = {
  summary: string;
  description: string;
  location?: string;
  /** RFC3339 instants (e.g. from Date#toISOString(), which always
   * includes a UTC offset) -- Google's API requires the offset be present
   * either way, so there's no separate timeZone field to set. */
  startISO: string;
  endISO: string;
  attendeeEmails: string[];
  weekCount: number;
};

/** Pure: the Calendar API request body. Split out from the network call so
 * it's testable without hitting Google. */
export function buildEventPayload(input: CalendarEventInput) {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startISO },
    end: { dateTime: input.endISO },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${input.weekCount}`],
    reminders: { useDefault: true },
  };
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  // Env vars can't hold literal newlines cleanly, so the PEM is usually
  // stored with escaped "\n" sequences -- unescape them back to real ones.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const jwt = signServiceAccountJWT(email, privateKey, CALENDAR_SCOPE);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Creates a recurring weekly event (RRULE) on the configured calendar,
 * inviting every attendee. Assumes the calendar has already been shared
 * with the service account. */
export async function createRecurringEvent(
  input: CalendarEventInput,
): Promise<{ id: string }> {
  if (!isGoogleCalendarConfigured()) {
    throw new Error("Google Calendar is not configured (missing GOOGLE_* env vars)");
  }
  const token = await getAccessToken();
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventPayload(input)),
    },
  );
  if (!res.ok) {
    throw new Error(`Google Calendar event creation failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
