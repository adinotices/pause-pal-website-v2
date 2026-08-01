import type { Candidate, ExperienceLevelValue, SessionLengthValue } from "../types";
import { toCanonicalIntervals, type LocalSlot } from "../availability";

let nextSignupId = 1;

/** Builds a Candidate directly (skipping real timezone resolution) so
 * compatibility/solve tests can control availability and offsets exactly. */
export function testCandidate(overrides: {
  firstName: string;
  localSlots: LocalSlot[];
  utcOffsetMinutes?: number;
  sessionsPerWeek?: number;
  sessionLength?: SessionLengthValue;
  ownGenderIdentity?: string | null;
  partnerGenderPreference?: string | null;
  partnerGenderIsHardRequirement?: boolean;
  experienceLevel?: ExperienceLevelValue;
  signupId?: number;
}): Candidate {
  const offset = overrides.utcOffsetMinutes ?? 0;
  const signupId = overrides.signupId ?? nextSignupId++;
  return {
    signupId,
    personId: signupId,
    firstName: overrides.firstName,
    timezone: "UTC",
    sessionsPerWeek: overrides.sessionsPerWeek ?? 3,
    sessionLength: overrides.sessionLength ?? "15",
    ownGenderIdentity: overrides.ownGenderIdentity ?? null,
    partnerGenderPreference: overrides.partnerGenderPreference ?? null,
    partnerGenderIsHardRequirement: overrides.partnerGenderIsHardRequirement ?? false,
    experienceLevel: overrides.experienceLevel ?? "new",
    localSlots: overrides.localSlots,
    utcOffsetMinutes: offset,
    canonicalAvailability: toCanonicalIntervals(overrides.localSlots, offset),
  };
}

/** Mon/Wed/Fri 6-7am and 6-7pm, generous availability for tests that don't
 * care about the exact schedule. */
export const GENEROUS_SLOTS: LocalSlot[] = [1, 3, 5].flatMap((day) => [
  { dayOfWeek: day, startMinute: 360, endMinute: 420 },
  { dayOfWeek: day, startMinute: 1080, endMinute: 1140 },
]);
