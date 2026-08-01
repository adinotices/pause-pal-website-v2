import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { cohorts, matchMembers, matches, signups } from "./schema";
import { buildCandidate, type RawSignupInput } from "@/lib/matching/candidate";
import { generateMatches } from "@/lib/matching/solve";
import { pairKey } from "@/lib/matching/compatibility";

/** Signups still eligible to be matched for a cohort: submitted, and not
 * already locked into a pinned proposed match (approved signups are
 * already excluded by the status filter -- see submitSignup/approveMatches). */
async function getCandidatePool(cohortId: number, excludeSignupIds: Set<number>) {
  const rows = await db.query.signups.findMany({
    where: and(eq(signups.cohortId, cohortId), eq(signups.status, "submitted")),
    with: { person: true, availabilitySlots: true, preferences: true },
  });
  return rows.filter((r) => !excludeSignupIds.has(r.id) && r.preferences !== null);
}

async function getPinnedMemberSignupIds(cohortId: number): Promise<Set<number>> {
  const rows = await db
    .select({ signupId: matchMembers.signupId })
    .from(matchMembers)
    .innerJoin(matches, eq(matchMembers.matchId, matches.id))
    .where(and(eq(matches.cohortId, cohortId), eq(matches.status, "proposed"), eq(matches.pinned, true)));
  return new Set(rows.map((r) => r.signupId));
}

/** personId-pair keys (see lib/matching/compatibility.ts) for everyone
 * who has ever been in the same *approved* match together, across all
 * cohorts. Proposed-but-never-approved matches don't count -- nothing
 * actually happened. */
export async function getPreviousMatchHistoryPairKeys(): Promise<Set<string>> {
  const rows = await db
    .select({ matchId: matchMembers.matchId, personId: signups.personId })
    .from(matchMembers)
    .innerJoin(signups, eq(matchMembers.signupId, signups.id))
    .innerJoin(matches, eq(matchMembers.matchId, matches.id))
    .where(eq(matches.status, "approved"));

  const byMatch = new Map<number, number[]>();
  for (const row of rows) {
    const list = byMatch.get(row.matchId) ?? [];
    list.push(row.personId);
    byMatch.set(row.matchId, list);
  }

  const keys = new Set<string>();
  for (const personIds of byMatch.values()) {
    for (let i = 0; i < personIds.length; i++) {
      for (let j = i + 1; j < personIds.length; j++) {
        keys.add(pairKey(personIds[i], personIds[j]));
      }
    }
  }
  return keys;
}

export function toRawSignupInput(row: {
  id: number;
  personId: number;
  person: { firstName: string; timezone: string };
  availabilitySlots: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  preferences: {
    sessionsPerWeek: number;
    sessionLength: RawSignupInput["sessionLength"];
    ownGenderIdentity: string | null;
    partnerGenderPreference: string | null;
    partnerGenderIsHardRequirement: boolean;
    experienceLevel: RawSignupInput["experienceLevel"];
  } | null;
}): RawSignupInput {
  if (!row.preferences) {
    throw new Error(`Signup ${row.id} has no preferences row -- should have been filtered out`);
  }
  return {
    signupId: row.id,
    personId: row.personId,
    firstName: row.person.firstName,
    timezone: row.person.timezone,
    sessionsPerWeek: row.preferences.sessionsPerWeek,
    sessionLength: row.preferences.sessionLength,
    ownGenderIdentity: row.preferences.ownGenderIdentity,
    partnerGenderPreference: row.preferences.partnerGenderPreference,
    partnerGenderIsHardRequirement: row.preferences.partnerGenderIsHardRequirement,
    experienceLevel: row.preferences.experienceLevel,
    localSlots: row.availabilitySlots,
  };
}

export type GenerateProposalsResult = {
  proposedGroupCount: number;
  unmatchedSignupIds: number[];
};

/**
 * (Re)generates proposed matches for a cohort. Pinned proposed matches are
 * left untouched and their members excluded from the new solve; every
 * other non-pinned proposed match for this cohort is replaced. Approved
 * matches are never touched here (their signups aren't in the candidate
 * pool since their status is no longer "submitted").
 */
export async function generateProposalsForCohort(
  cohortId: number,
): Promise<GenerateProposalsResult> {
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) throw new Error(`Cohort ${cohortId} not found`);
  if (!cohort.startsOn) {
    throw new Error(
      `Cohort ${cohort.number} has no start date set -- can't resolve timezones for matching`,
    );
  }

  const pinnedSignupIds = await getPinnedMemberSignupIds(cohortId);
  const candidateRows = await getCandidatePool(cohortId, pinnedSignupIds);
  const candidates = candidateRows.map((row) =>
    buildCandidate(toRawSignupInput(row), cohort.startsOn!),
  );
  const previouslyMatchedPairKeys = await getPreviousMatchHistoryPairKeys();

  const result = generateMatches(candidates, previouslyMatchedPairKeys);

  await db.transaction(async (tx) => {
    await tx
      .delete(matches)
      .where(and(eq(matches.cohortId, cohortId), eq(matches.status, "proposed"), eq(matches.pinned, false)));

    for (const group of result.groups) {
      const [inserted] = await tx
        .insert(matches)
        .values({
          cohortId,
          status: "proposed",
          pinned: false,
          score: group.score,
          explanation: group.explanation,
        })
        .returning();

      await tx.insert(matchMembers).values(
        group.signupIds.map((signupId) => ({ matchId: inserted.id, signupId })),
      );
    }
  });

  return {
    proposedGroupCount: result.groups.length,
    unmatchedSignupIds: result.unmatchedSignupIds,
  };
}

export async function setMatchPinned(matchId: number, pinned: boolean) {
  await db.update(matches).set({ pinned }).where(eq(matches.id, matchId));
}

/** Deletes a proposed match, freeing its members back into the candidate
 * pool for the next "generate proposals" run. Refuses to delete an
 * already-approved match -- that's a real, finalized pairing. */
export async function deleteProposedMatch(matchId: number) {
  await db.delete(matches).where(and(eq(matches.id, matchId), eq(matches.status, "proposed")));
}

/** Finalizes every currently-proposed match for a cohort: marks the
 * matches approved and the member signups as matched, and advances the
 * cohort to the `matched` state. */
export async function approveMatchesForCohort(cohortId: number) {
  await db.transaction(async (tx) => {
    const proposed = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.cohortId, cohortId), eq(matches.status, "proposed")));

    for (const match of proposed) {
      const members = await tx
        .select({ signupId: matchMembers.signupId })
        .from(matchMembers)
        .where(eq(matchMembers.matchId, match.id));

      await tx.update(matches).set({ status: "approved" }).where(eq(matches.id, match.id));

      for (const member of members) {
        await tx
          .update(signups)
          .set({ status: "matched" })
          .where(eq(signups.id, member.signupId));
      }
    }

    await tx.update(cohorts).set({ state: "matched" }).where(eq(cohorts.id, cohortId));
  });
}

export type MatchWithMembers = {
  id: number;
  status: "proposed" | "approved";
  pinned: boolean;
  score: number;
  explanation: string;
  members: {
    signupId: number;
    firstName: string;
    email: string;
  }[];
};

export async function listMatchesForCohort(cohortId: number): Promise<MatchWithMembers[]> {
  const rows = await db.query.matches.findMany({
    where: eq(matches.cohortId, cohortId),
    orderBy: (m, { desc }) => desc(m.score),
    with: {
      members: {
        with: {
          signup: { with: { person: true } },
        },
      },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    status: m.status,
    pinned: m.pinned,
    score: m.score,
    explanation: m.explanation,
    members: m.members.map((mm) => ({
      signupId: mm.signupId,
      firstName: mm.signup.person.firstName,
      email: mm.signup.person.email,
    })),
  }));
}

/** Submitted signups for a cohort that aren't currently part of any match
 * (proposed or approved) -- these need a human to look at. */
export async function listUnmatchedSignupsForCohort(cohortId: number) {
  const matched = await db
    .select({ signupId: matchMembers.signupId })
    .from(matchMembers)
    .innerJoin(matches, eq(matchMembers.matchId, matches.id))
    .where(eq(matches.cohortId, cohortId));
  const matchedIds = new Set(matched.map((m) => m.signupId));

  const rows = await db.query.signups.findMany({
    where: and(eq(signups.cohortId, cohortId), eq(signups.status, "submitted")),
    with: { person: true },
  });

  return rows.filter((r) => !matchedIds.has(r.id));
}
