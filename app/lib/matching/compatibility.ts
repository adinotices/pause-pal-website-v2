import { intersectIntervals, type WeeklyInterval } from "./availability";
import { checkGenderPreference } from "./gender";
import {
  EXPERIENCE_RANK,
  SESSION_LENGTH_MINUTES,
  type Candidate,
} from "./types";

/** Unordered pair/group membership key, e.g. "3-17-42" for signup ids
 * [42, 3, 17]. Used both for "were these two previously matched" lookups
 * and to enumerate the pairs within a candidate group. */
export function pairKey(signupIdA: number, signupIdB: number): string {
  return [signupIdA, signupIdB].sort((a, b) => a - b).join("-");
}

function combinations<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

export interface GroupEvaluation {
  feasible: boolean;
  blockedReason?: string;
  score: number;
  desiredSessions: number;
  sessionsAvailable: number;
  overlapWindows: WeeklyInterval[];
  explanation: string;
}

// Nominal weight budget out of ~100 (gender/repeat adjustments can push
// scores outside that range) -- these are the levers to tune between
// cohorts if the matches don't feel right in practice.
const WEIGHTS = {
  overlapAdequacy: 40,
  sessionLengthFit: 15,
  frequencyFit: 15,
  experienceFit: 10,
  timezoneProximity: 10,
  genderSoftBonus: 5,
  repeatPairingPenalty: 15,
};

/**
 * Evaluates a candidate group of 2 (the common case) or 3 (the odd-person-
 * out fallback -- see lib/matching/solve.ts) people as a potential match.
 * Hard constraints (a stated gender requirement, or literally zero shared
 * availability) make the group infeasible outright; everything else feeds
 * into a soft score used to rank feasible groups against each other.
 *
 * `previouslyMatchedPairKeys` must be keyed by `pairKey(personId, personId)`
 * (not signupId) -- a person gets a new signup row every cohort, so
 * cross-cohort history has to be tracked by the stable person identity.
 */
export function evaluateGroup(
  members: Candidate[],
  previouslyMatchedPairKeys: ReadonlySet<string>,
): GroupEvaluation {
  const pairs = combinations(members);

  // --- Hard constraints ------------------------------------------------
  for (const [a, b] of pairs) {
    if (a.partnerGenderIsHardRequirement) {
      const result = checkGenderPreference(a.partnerGenderPreference, b.ownGenderIdentity);
      if (result !== "satisfied") {
        return infeasible(
          `${a.firstName}'s partner gender requirement isn't confirmed satisfied by ${b.firstName}`,
        );
      }
    }
    if (b.partnerGenderIsHardRequirement) {
      const result = checkGenderPreference(b.partnerGenderPreference, a.ownGenderIdentity);
      if (result !== "satisfied") {
        return infeasible(
          `${b.firstName}'s partner gender requirement isn't confirmed satisfied by ${a.firstName}`,
        );
      }
    }
  }

  const effectiveSessionMinutes = Math.min(
    ...members.map((m) => SESSION_LENGTH_MINUTES[m.sessionLength]),
  );
  const desiredSessions = Math.min(...members.map((m) => m.sessionsPerWeek));

  const overlapWindows = members
    .map((m) => m.canonicalAvailability)
    .reduce((acc, next) => intersectIntervals(acc, next));

  let sessionsAvailable = 0;
  for (const w of overlapWindows) {
    sessionsAvailable += Math.floor((w.end - w.start) / effectiveSessionMinutes);
  }

  if (sessionsAvailable === 0) {
    return infeasible("No shared weekly time long enough for even one session");
  }

  // --- Soft scoring ------------------------------------------------------
  const overlapAdequacy =
    Math.min(sessionsAvailable / desiredSessions, 1) * WEIGHTS.overlapAdequacy;

  const lengthMinutes = members.map((m) => SESSION_LENGTH_MINUTES[m.sessionLength]);
  const lengthSpread = Math.max(...lengthMinutes) - Math.min(...lengthMinutes);
  const sessionLengthFit = Math.max(0, 1 - lengthSpread / 25) * WEIGHTS.sessionLengthFit;

  const freqSpread =
    Math.max(...members.map((m) => m.sessionsPerWeek)) -
    Math.min(...members.map((m) => m.sessionsPerWeek));
  const frequencyFit = Math.max(0, 1 - freqSpread / 6) * WEIGHTS.frequencyFit;

  const expRanks = members.map((m) => EXPERIENCE_RANK[m.experienceLevel]);
  const expSpread = Math.max(...expRanks) - Math.min(...expRanks);
  const experienceFit = Math.max(0, 1 - expSpread / 2) * WEIGHTS.experienceFit;

  const offsetSpreadHours =
    (Math.max(...members.map((m) => m.utcOffsetMinutes)) -
      Math.min(...members.map((m) => m.utcOffsetMinutes))) /
    60;
  const timezoneProximity = Math.max(0, 1 - offsetSpreadHours / 12) * WEIGHTS.timezoneProximity;

  let genderAdjustment = 0;
  const genderNotes: string[] = [];
  for (const [a, b] of pairs) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as [Candidate, Candidate][]) {
      if (x.partnerGenderIsHardRequirement) continue; // already guaranteed satisfied above
      const result = checkGenderPreference(x.partnerGenderPreference, y.ownGenderIdentity);
      if (result === "satisfied" && x.partnerGenderPreference) {
        genderAdjustment += WEIGHTS.genderSoftBonus;
      } else if (result === "mismatch") {
        genderAdjustment -= WEIGHTS.genderSoftBonus;
        genderNotes.push(`${x.firstName} prefers a different partner gender than ${y.firstName}'s`);
      }
    }
  }

  let repeatPenalty = 0;
  const repeatNotes: string[] = [];
  for (const [a, b] of pairs) {
    // Keyed by personId, not signupId: signupId is a fresh row every
    // cohort, so a signupId-keyed check could never detect a real repeat
    // across cohorts.
    if (previouslyMatchedPairKeys.has(pairKey(a.personId, b.personId))) {
      repeatPenalty += WEIGHTS.repeatPairingPenalty;
      repeatNotes.push(`${a.firstName} & ${b.firstName} were matched in a previous cohort`);
    }
  }

  const score = Math.max(
    1,
    overlapAdequacy +
      sessionLengthFit +
      frequencyFit +
      experienceFit +
      timezoneProximity +
      genderAdjustment -
      repeatPenalty,
  );

  const explanation = buildExplanation({
    sessionsAvailable,
    desiredSessions,
    lengthMinutes,
    freqs: members.map((m) => m.sessionsPerWeek),
    offsetSpreadHours,
    genderNotes,
    repeatNotes,
  });

  return {
    feasible: true,
    score,
    desiredSessions,
    sessionsAvailable,
    overlapWindows,
    explanation,
  };
}

function infeasible(reason: string): GroupEvaluation {
  return {
    feasible: false,
    blockedReason: reason,
    score: 0,
    desiredSessions: 0,
    sessionsAvailable: 0,
    overlapWindows: [],
    explanation: reason,
  };
}

function buildExplanation(input: {
  sessionsAvailable: number;
  desiredSessions: number;
  lengthMinutes: number[];
  freqs: number[];
  offsetSpreadHours: number;
  genderNotes: string[];
  repeatNotes: string[];
}): string {
  const clauses: string[] = [];
  clauses.push(
    `${input.sessionsAvailable} shared weekly slot${input.sessionsAvailable === 1 ? "" : "s"} available (need ${input.desiredSessions})`,
  );
  clauses.push(`session length ${formatRange(input.lengthMinutes)} min`);
  clauses.push(`${formatRange(input.freqs)}x/week`);
  if (input.offsetSpreadHours > 0) {
    clauses.push(`${input.offsetSpreadHours}h apart in timezone`);
  } else {
    clauses.push("same timezone offset");
  }
  for (const note of input.genderNotes) clauses.push(note);
  for (const note of input.repeatNotes) clauses.push(note);
  return clauses.join(" · ");
}

function formatRange(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}` : `${min}–${max}`;
}
