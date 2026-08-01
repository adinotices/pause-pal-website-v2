import { describe, expect, it } from "vitest";
import { isFullyProcessed } from "../status";

const NONE_CONFIGURED = { zoomConfigured: false, calendarConfigured: false };
const BOTH_CONFIGURED = { zoomConfigured: true, calendarConfigured: true };

describe("isFullyProcessed", () => {
  it("is false with no sessions, regardless of config", () => {
    expect(isFullyProcessed({ zoomMeetingId: null, sessions: [] }, NONE_CONFIGURED)).toBe(false);
    expect(isFullyProcessed({ zoomMeetingId: "z1", sessions: [] }, BOTH_CONFIGURED)).toBe(false);
  });

  it("is true once sessions exist and nothing is configured", () => {
    const match = { zoomMeetingId: null, sessions: [{ googleCalendarEventId: null }] };
    expect(isFullyProcessed(match, NONE_CONFIGURED)).toBe(true);
  });

  it("is false when Zoom is configured but no meeting was created yet", () => {
    const match = { zoomMeetingId: null, sessions: [{ googleCalendarEventId: "e1" }] };
    expect(isFullyProcessed(match, { zoomConfigured: true, calendarConfigured: false })).toBe(
      false,
    );
  });

  it("is false when Calendar is configured but a session has no event yet", () => {
    const match = { zoomMeetingId: "z1", sessions: [{ googleCalendarEventId: null }] };
    expect(isFullyProcessed(match, { zoomConfigured: false, calendarConfigured: true })).toBe(
      false,
    );
  });

  it("is true only once every configured integration is actually done", () => {
    const match = { zoomMeetingId: "z1", sessions: [{ googleCalendarEventId: "e1" }] };
    expect(isFullyProcessed(match, BOTH_CONFIGURED)).toBe(true);
  });

  it("catches the stuck-forever bug: a match sent before config later needs work again", () => {
    // Sent while nothing was configured -- sessions exist, nothing else does.
    const match = { zoomMeetingId: null, sessions: [{ googleCalendarEventId: null }] };
    expect(isFullyProcessed(match, NONE_CONFIGURED)).toBe(true);
    // Zoom gets configured afterwards -- this match must now report unfinished,
    // not stay stuck as "done" forever.
    expect(isFullyProcessed(match, { zoomConfigured: true, calendarConfigured: false })).toBe(
      false,
    );
  });

  it("requires every session to have a calendar event, not just some", () => {
    const match = {
      zoomMeetingId: "z1",
      sessions: [{ googleCalendarEventId: "e1" }, { googleCalendarEventId: null }],
    };
    expect(isFullyProcessed(match, { zoomConfigured: false, calendarConfigured: true })).toBe(
      false,
    );
  });
});
