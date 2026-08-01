/**
 * Whether a match needs no further scheduling work *given which
 * integrations are currently configured*. Takes configuration as plain
 * booleans (rather than calling isZoomConfigured()/isGoogleCalendarConfigured()
 * itself) so it's a pure function of its inputs -- testable without env
 * vars, and re-evaluated fresh against live config every time the caller
 * checks it, rather than cached as a single "done" flag. That's what makes
 * it safe for a match sent while Zoom/Google were unconfigured to
 * correctly report as unfinished once those env vars are set, so the next
 * "Send" run picks up exactly the missing piece instead of skipping the
 * match forever.
 */
export function isFullyProcessed(
  match: {
    zoomMeetingId: string | null;
    sessions: { googleCalendarEventId: string | null }[];
  },
  config: { zoomConfigured: boolean; calendarConfigured: boolean },
): boolean {
  const hasSessions = match.sessions.length > 0;
  const zoomDone = Boolean(match.zoomMeetingId) || !config.zoomConfigured;
  const calendarDone =
    !config.calendarConfigured || match.sessions.every((s) => s.googleCalendarEventId);
  return hasSessions && zoomDone && calendarDone;
}
