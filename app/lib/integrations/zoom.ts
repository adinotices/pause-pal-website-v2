import { isZoomConfigured } from "./config";

/**
 * Zoom Server-to-Server OAuth (account-level app, no per-user consent
 * flow) -- see app/README.md for how to set one up. Implemented against
 * Zoom's documented REST API; not exercised against a live Zoom account in
 * this codebase (no test credentials available), so treat as unverified
 * until it's run once against a real account.
 */

export { isZoomConfigured };

export type ZoomMeeting = { id: string; joinUrl: string };

/** Pure: the request body for creating a recurring, no-fixed-time meeting.
 * Split out from the network call so it's testable without hitting Zoom. */
export function buildCreateMeetingPayload(topic: string) {
  return {
    topic,
    type: 3, // recurring meeting, no fixed time -- one stable link for the whole program
    settings: {
      join_before_host: true,
      waiting_room: false,
      mute_upon_entry: true,
      approval_type: 2, // no registration required
    },
  };
}

async function getAccessToken(): Promise<string> {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  const basicAuth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    { method: "POST", headers: { Authorization: `Basic ${basicAuth}` } },
  );
  if (!res.ok) {
    throw new Error(`Zoom OAuth token request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Creates one recurring, no-fixed-time Zoom meeting under the configured
 * host account. Reused as the single stable link for all of a match's
 * weekly sessions for the whole program. */
export async function createRecurringMeeting(topic: string): Promise<ZoomMeeting> {
  if (!isZoomConfigured()) {
    throw new Error("Zoom is not configured (missing ZOOM_* env vars)");
  }
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(process.env.ZOOM_HOST_EMAIL!)}/meetings`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildCreateMeetingPayload(topic)),
    },
  );
  if (!res.ok) {
    throw new Error(`Zoom meeting creation failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: number | string; join_url: string };
  return { id: String(data.id), joinUrl: data.join_url };
}

/** Cancels a meeting created by `createRecurringMeeting`. Used as a
 * compensating action when the meeting was created successfully but the
 * DB write that was meant to record it failed -- without this, the next
 * scheduling run would see no `zoomMeetingId` stored and create a second,
 * orphaned meeting for the same match. Best-effort: callers should log
 * (not throw) on failure, since a leftover unused meeting is a much
 * smaller problem than losing the original DB-write error. */
export async function cancelMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Zoom meeting cancellation failed: ${res.status} ${await res.text()}`);
  }
}
