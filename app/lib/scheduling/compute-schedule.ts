import { summarizeOverlap } from "@/lib/matching/availability";
import { buildCandidate, type RawSignupInput } from "@/lib/matching/candidate";
import { SESSION_LENGTH_MINUTES } from "@/lib/matching/types";
import { pickSessionTimes, type CanonicalSessionSlot } from "./pick-sessions";
import { firstOccurrenceUTC } from "./instants";

export type ComputedSession = CanonicalSessionSlot & { firstOccurrenceAt: Date };

/**
 * Pure orchestration: given a match's member signups and the cohort's
 * start date, recomputes the same availability overlap the matching
 * engine used (there's no persisted "the overlap was X" record -- it's
 * cheap to rederive and this keeps a single source of truth for the
 * overlap math) and picks real calendar times for each weekly session.
 * How many weeks those sessions repeat for is a separate concern handled
 * by the caller (see lib/scheduling/instants.ts's computeWeekCount) --
 * this function only decides *which* weekly slots to use.
 */
export function computeMatchSchedule(
  members: RawSignupInput[],
  cohortStartsOn: string,
): ComputedSession[] {
  if (members.length < 2) return [];

  const candidates = members.map((m) => buildCandidate(m, cohortStartsOn));

  const effectiveSessionMinutes = Math.min(
    ...candidates.map((c) => SESSION_LENGTH_MINUTES[c.sessionLength]),
  );
  const desiredSessions = Math.min(...candidates.map((c) => c.sessionsPerWeek));

  const { windows: overlapWindows } = summarizeOverlap(
    candidates.map((c) => c.canonicalAvailability),
    effectiveSessionMinutes,
  );

  const slots = pickSessionTimes(overlapWindows, effectiveSessionMinutes, desiredSessions);

  return slots.map((slot) => ({
    ...slot,
    firstOccurrenceAt: firstOccurrenceUTC(cohortStartsOn, slot.dayOfWeek, slot.startMinute),
  }));
}
