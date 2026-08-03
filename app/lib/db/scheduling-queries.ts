import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { cohorts, matchSessions, matches } from "./schema";
import { toRawSignupInput } from "./matching-queries";
import { computeMatchSchedule, type ComputedSession } from "@/lib/scheduling/compute-schedule";
import { computeWeekCount } from "@/lib/scheduling/instants";
import { isFullyProcessed } from "@/lib/scheduling/status";
import { isGoogleCalendarConfigured, isZoomConfigured } from "@/lib/integrations/config";
import { cancelMeeting, createRecurringMeeting } from "@/lib/integrations/zoom";
import { createRecurringEvent } from "@/lib/integrations/google-calendar";

async function getApprovedMatchesWithMembers(cohortId: number) {
  const rows = await db.query.matches.findMany({
    where: and(eq(matches.cohortId, cohortId), eq(matches.status, "approved")),
    with: {
      members: {
        with: {
          signup: { with: { person: true, availabilitySlots: true, preferences: true } },
        },
      },
      sessions: true,
    },
  });
  return rows;
}

function topicFor(firstNames: string[]): string {
  return `PausePal: ${firstNames.join(" & ")}`;
}

function isMatchFullyProcessed(match: {
  zoomMeetingId: string | null;
  sessions: { googleCalendarEventId: string | null }[];
}): boolean {
  return isFullyProcessed(match, {
    zoomConfigured: isZoomConfigured(),
    calendarConfigured: isGoogleCalendarConfigured(),
  });
}

export type MatchSchedulePreview = {
  matchId: number;
  topic: string;
  members: { firstName: string; timezone: string; email: string }[];
  alreadyScheduled: boolean;
  zoomJoinUrl: string | null;
  weekCount: number;
  sessions: (ComputedSession & { existing: boolean })[];
};

/** Pure preview -- computes what the schedule *would* be, with no side
 * effects and no external API calls. Safe to call any time. */
export async function previewScheduleForCohort(cohortId: number): Promise<MatchSchedulePreview[]> {
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort?.startsOn) return [];
  const weekCount = computeWeekCount(cohort.startsOn, cohort.endsOn);

  const approvedMatches = await getApprovedMatchesWithMembers(cohortId);

  return approvedMatches.map((match) => {
    const memberInputs = match.members.map((mm) => toRawSignupInput(mm.signup));
    const firstNames = memberInputs.map((m) => m.firstName);
    const members = match.members.map((mm) => ({
      firstName: mm.signup.person.firstName,
      timezone: mm.signup.person.timezone,
      email: mm.signup.person.email,
    }));

    if (match.sessions.length > 0) {
      // Already scheduled (or a prior attempt got partway there) -- show
      // the times we actually stored, not a freshly recomputed guess.
      return {
        matchId: match.id,
        topic: topicFor(firstNames),
        members,
        alreadyScheduled: isMatchFullyProcessed(match),
        zoomJoinUrl: match.zoomJoinUrl,
        weekCount: match.sessions[0]?.weekCount ?? weekCount,
        sessions: match.sessions.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          firstOccurrenceAt: s.firstOccurrenceAt,
          existing: true,
        })),
      };
    }

    const computed = computeMatchSchedule(memberInputs, cohort.startsOn!);
    return {
      matchId: match.id,
      topic: topicFor(firstNames),
      members,
      alreadyScheduled: false,
      zoomJoinUrl: match.zoomJoinUrl,
      weekCount,
      sessions: computed.map((s) => ({ ...s, existing: false })),
    };
  });
}

export type SendScheduleResult = {
  matchId: number;
  status: "skipped_already_scheduled" | "scheduled" | "error";
  zoomCreated: boolean;
  calendarEventsCreated: number;
  error?: string;
};

/**
 * Idempotently schedules every approved match in a cohort that isn't
 * already fully processed (see `isFullyProcessed`): creates (or reuses)
 * one Zoom meeting per match and one recurring Google Calendar event per
 * weekly session, then records when it last ran. A match is only skipped
 * once it has session times *and* every integration that's actually
 * configured has completed for it -- so a match sent before Zoom/Google
 * were configured isn't stuck forever; configuring them and sending again
 * picks up exactly the missing piece. A match that partially succeeded on
 * a prior attempt (e.g. Zoom created but Calendar failed) resumes from
 * where it left off rather than redoing work or duplicating meetings/
 * events.
 */
export async function sendScheduleForCohort(cohortId: number): Promise<SendScheduleResult[]> {
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort?.startsOn) {
    throw new Error("Cohort has no start date -- can't schedule sessions");
  }
  const weekCount = computeWeekCount(cohort.startsOn, cohort.endsOn);
  const approvedMatches = await getApprovedMatchesWithMembers(cohortId);

  const results: SendScheduleResult[] = [];

  for (const match of approvedMatches) {
    if (isMatchFullyProcessed(match)) {
      results.push({ matchId: match.id, status: "skipped_already_scheduled", zoomCreated: false, calendarEventsCreated: 0 });
      continue;
    }

    try {
      const memberInputs = match.members.map((mm) => toRawSignupInput(mm.signup));
      const firstNames = memberInputs.map((m) => m.firstName);
      const attendeeEmails = match.members.map((mm) => mm.signup.person.email);
      const topic = topicFor(firstNames);

      let zoomMeetingId = match.zoomMeetingId;
      let zoomJoinUrl = match.zoomJoinUrl;
      let zoomCreated = false;
      if (!zoomMeetingId && isZoomConfigured()) {
        const meeting = await createRecurringMeeting(topic);
        try {
          await db
            .update(matches)
            .set({ zoomMeetingId: meeting.id, zoomJoinUrl: meeting.joinUrl })
            .where(eq(matches.id, match.id));
        } catch (persistErr) {
          // The meeting now exists on Zoom's side but we couldn't record
          // it, so the next run would see zoomMeetingId still null and
          // create a *second* meeting. Cancel this one so a retry starts
          // clean instead of accumulating orphaned meetings, then
          // propagate the original DB error.
          await cancelMeeting(meeting.id).catch((cancelErr) => {
            console.error(
              `Failed to cancel orphaned Zoom meeting ${meeting.id} for match ${match.id} after DB write failure`,
              cancelErr,
            );
          });
          throw persistErr;
        }
        zoomMeetingId = meeting.id;
        zoomJoinUrl = meeting.joinUrl;
        zoomCreated = true;
      }

      let sessionRows = match.sessions;
      if (sessionRows.length === 0) {
        const computed = computeMatchSchedule(memberInputs, cohort.startsOn!);
        if (computed.length === 0) {
          throw new Error("No shared session times could be computed for this match");
        }
        const inserted = await db
          .insert(matchSessions)
          .values(
            computed.map((s) => ({
              matchId: match.id,
              dayOfWeek: s.dayOfWeek,
              startMinute: s.startMinute,
              endMinute: s.endMinute,
              firstOccurrenceAt: s.firstOccurrenceAt,
              weekCount,
            })),
          )
          .returning();
        sessionRows = inserted;
      }

      let calendarEventsCreated = 0;
      if (isGoogleCalendarConfigured()) {
        for (const session of sessionRows) {
          if (session.googleCalendarEventId) continue;
          const endAt = new Date(session.firstOccurrenceAt.getTime() + (session.endMinute - session.startMinute) * 60000);
          const event = await createRecurringEvent({
            summary: topic,
            description: zoomJoinUrl
              ? `Meditate together via Zoom: ${zoomJoinUrl}`
              : "PausePal meditation session. Zoom link to follow.",
            location: zoomJoinUrl ?? undefined,
            startISO: session.firstOccurrenceAt.toISOString(),
            endISO: endAt.toISOString(),
            attendeeEmails,
            weekCount: session.weekCount,
          });
          await db
            .update(matchSessions)
            .set({ googleCalendarEventId: event.id })
            .where(eq(matchSessions.id, session.id));
          calendarEventsCreated++;
        }
      }

      await db.update(matches).set({ scheduledAt: new Date() }).where(eq(matches.id, match.id));

      results.push({ matchId: match.id, status: "scheduled", zoomCreated, calendarEventsCreated });
    } catch (err) {
      results.push({
        matchId: match.id,
        status: "error",
        zoomCreated: false,
        calendarEventsCreated: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Advance the cohort's state once every approved match is genuinely
  // done -- not just "we tried" (an error still leaves the cohort at
  // `matched` so it's obvious there's follow-up needed). Only moves
  // forward from `matched`; never overwrites a later state (e.g. if this
  // somehow re-runs after the cohort has already started running).
  const anyErrors = results.some((r) => r.status === "error");
  if (!anyErrors && results.length > 0 && cohort.state === "matched") {
    await db.update(cohorts).set({ state: "scheduled" }).where(eq(cohorts.id, cohortId));
  }

  return results;
}
