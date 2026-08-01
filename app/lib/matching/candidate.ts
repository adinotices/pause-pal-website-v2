import { toCanonicalIntervals, type LocalSlot } from "./availability";
import { utcOffsetMinutes } from "./tz";
import type { Candidate, ExperienceLevelValue, SessionLengthValue } from "./types";

export interface RawSignupInput {
  signupId: number;
  personId: number;
  firstName: string;
  timezone: string;
  sessionsPerWeek: number;
  sessionLength: SessionLengthValue;
  ownGenderIdentity: string | null;
  partnerGenderPreference: string | null;
  partnerGenderIsHardRequirement: boolean;
  experienceLevel: ExperienceLevelValue;
  localSlots: LocalSlot[];
}

/** Resolves timezone-dependent fields once per candidate, against the
 * cohort's actual start date -- see lib/matching/tz.ts for why the date
 * matters (DST). */
export function buildCandidate(raw: RawSignupInput, cohortStartISO: string): Candidate {
  const offset = utcOffsetMinutes(raw.timezone, cohortStartISO);
  return {
    ...raw,
    utcOffsetMinutes: offset,
    canonicalAvailability: toCanonicalIntervals(raw.localSlots, offset),
  };
}
