import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  availabilitySlots,
  cohorts,
  people,
  preferences,
  signups,
} from "./schema";

export type AvailabilityInput = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type SignupInput = {
  cohortId: number;
  firstName: string;
  email: string;
  timezone: string;
  availability: AvailabilityInput[];
  sessionsPerWeek: number;
  sessionLength: (typeof preferences.$inferInsert)["sessionLength"];
  ownGenderIdentity: string;
  partnerGenderPreference: string;
  partnerGenderIsHardRequirement: boolean;
  experienceLevel: (typeof preferences.$inferInsert)["experienceLevel"];
  notes: string;
};

/** The single cohort currently accepting signups, if any. Phase 1 assumes
 * at most one open cohort at a time. */
export async function getOpenCohort() {
  const [cohort] = await db
    .select()
    .from(cohorts)
    .where(eq(cohorts.state, "open"))
    .orderBy(desc(cohorts.number))
    .limit(1);
  return cohort ?? null;
}

export async function getCohortByNumber(number: number) {
  const [cohort] = await db
    .select()
    .from(cohorts)
    .where(eq(cohorts.number, number))
    .limit(1);
  return cohort ?? null;
}

/** Thrown by submitSignup when a signup for the same cohort already exists
 * and is past the point where silently replacing it is safe (matched or
 * withdrawn) -- see the comment on submitSignup for why. */
export class SignupAlreadyFinalizedError extends Error {
  constructor() {
    super("This signup has already been matched (or withdrawn) and can no longer be edited here.");
    this.name = "SignupAlreadyFinalizedError";
  }
}

/** Upserts the person by email, then creates (or replaces) their signup for
 * the given cohort. Re-submitting the form for the same cohort overwrites
 * the previous submission rather than erroring, since the most common
 * reason someone re-submits is "I made a mistake" -- *but only while the
 * signup is still in its default `submitted` state*. Once it's `matched`,
 * silently delete-and-recreating it would cascade-delete the match itself
 * (matchMembers.signupId is ON DELETE CASCADE), taking an approved,
 * possibly-already-scheduled pairing down with it. That's real, live state
 * a re-submitted typo-fix form should never be able to destroy, so this
 * refuses instead. */
export async function submitSignup(input: SignupInput) {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .insert(people)
      .values({
        email: input.email.toLowerCase().trim(),
        firstName: input.firstName.trim(),
        timezone: input.timezone,
      })
      .onConflictDoUpdate({
        target: people.email,
        set: { firstName: input.firstName.trim(), timezone: input.timezone },
      })
      .returning();

    const [existing] = await tx
      .select({ id: signups.id, status: signups.status })
      .from(signups)
      .where(
        and(
          eq(signups.cohortId, input.cohortId),
          eq(signups.personId, person.id),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status !== "submitted") {
        throw new SignupAlreadyFinalizedError();
      }
      await tx.delete(signups).where(eq(signups.id, existing.id));
    }

    const [signup] = await tx
      .insert(signups)
      .values({
        cohortId: input.cohortId,
        personId: person.id,
        agreedToCommitmentAt: new Date(),
      })
      .returning();

    if (input.availability.length > 0) {
      await tx.insert(availabilitySlots).values(
        input.availability.map((slot) => ({
          signupId: signup.id,
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        })),
      );
    }

    await tx.insert(preferences).values({
      signupId: signup.id,
      sessionsPerWeek: input.sessionsPerWeek,
      sessionLength: input.sessionLength,
      ownGenderIdentity: input.ownGenderIdentity.trim() || null,
      partnerGenderPreference: input.partnerGenderPreference.trim() || null,
      partnerGenderIsHardRequirement: input.partnerGenderIsHardRequirement,
      experienceLevel: input.experienceLevel,
      notes: input.notes.trim() || null,
    });

    return signup;
  });
}

export async function listSignupsForCohort(cohortId: number) {
  const rows = await db.query.signups.findMany({
    where: eq(signups.cohortId, cohortId),
    orderBy: desc(signups.submittedAt),
    with: {
      person: true,
      availabilitySlots: true,
      preferences: true,
    },
  });
  return rows;
}

export async function listCohorts() {
  return db.select().from(cohorts).orderBy(desc(cohorts.number));
}
