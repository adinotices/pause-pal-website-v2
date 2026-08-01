import type { WeeklyInterval, LocalSlot } from "./availability";

export type SessionLengthValue = "5" | "10" | "15" | "20" | "30" | "30_plus";
export type ExperienceLevelValue = "new" | "some_experience" | "experienced";

/** Everything the matcher needs about one signup, pre-processed once
 * (canonical availability resolved against the cohort's start date) so
 * pairwise evaluation never has to touch timezone math directly. */
export interface Candidate {
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
  canonicalAvailability: WeeklyInterval[];
  /** This signup's timezone UTC offset (minutes) on the cohort's start
   * date -- see lib/matching/tz.ts. */
  utcOffsetMinutes: number;
}

export const SESSION_LENGTH_MINUTES: Record<SessionLengthValue, number> = {
  "5": 5,
  "10": 10,
  "15": 15,
  "20": 20,
  "30": 30,
  "30_plus": 30,
};

export const EXPERIENCE_RANK: Record<ExperienceLevelValue, number> = {
  new: 0,
  some_experience: 1,
  experienced: 2,
};
