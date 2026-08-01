import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { cohorts, feedback, people, signups } from "./schema";

/** The signup feedback should attach to: a matched signup, most recent
 * first. Feedback is scoped to a signup (i.e. one cohort's participation),
 * not the person overall, since someone could do multiple cohorts. */
export async function getFeedbackTargetForPerson(personId: number) {
  const signup = await db.query.signups.findFirst({
    where: and(eq(signups.personId, personId), eq(signups.status, "matched")),
    orderBy: (s, { desc: d }) => d(s.submittedAt),
    with: { cohort: true, feedback: true },
  });
  return signup ?? null;
}

export async function submitFeedback(input: {
  signupId: number;
  rating: number;
  text: string;
  consentToPublish: boolean;
}) {
  await db
    .insert(feedback)
    .values({
      signupId: input.signupId,
      rating: input.rating,
      text: input.text,
      consentToPublish: input.consentToPublish,
    })
    .onConflictDoUpdate({
      target: feedback.signupId,
      set: { rating: input.rating, text: input.text, consentToPublish: input.consentToPublish },
    });
}

export async function listFeedbackForAdmin() {
  const rows = await db
    .select({
      id: feedback.id,
      rating: feedback.rating,
      text: feedback.text,
      consentToPublish: feedback.consentToPublish,
      published: feedback.published,
      publishDisplayName: feedback.publishDisplayName,
      createdAt: feedback.createdAt,
      firstName: people.firstName,
      email: people.email,
      cohortNumber: cohorts.number,
    })
    .from(feedback)
    .innerJoin(signups, eq(feedback.signupId, signups.id))
    .innerJoin(people, eq(signups.personId, people.id))
    .innerJoin(cohorts, eq(signups.cohortId, cohorts.id))
    .orderBy(desc(feedback.createdAt));
  return rows;
}

export async function setFeedbackPublication(
  feedbackId: number,
  input: { published: boolean; publishDisplayName: string },
) {
  await db
    .update(feedback)
    .set({ published: input.published, publishDisplayName: input.publishDisplayName || null })
    .where(eq(feedback.id, feedbackId));
}

export type PublicTestimonial = { displayName: string; rating: number; text: string };

/**
 * `consentToPublish` is re-checked here, not just at publish time: a
 * participant can re-submit the feedback form with the consent box
 * unticked, which flips `consentToPublish` back to false but leaves the
 * admin's earlier `published` flag alone. Filtering on consent at read
 * time is what makes withdrawing consent actually take the testimonial
 * off the marketing site.
 */
export async function listPublishedTestimonials(): Promise<PublicTestimonial[]> {
  const rows = await db
    .select({
      publishDisplayName: feedback.publishDisplayName,
      rating: feedback.rating,
      text: feedback.text,
    })
    .from(feedback)
    .where(
      and(
        eq(feedback.published, true),
        eq(feedback.consentToPublish, true),
        isNotNull(feedback.publishDisplayName),
      ),
    )
    .orderBy(desc(feedback.createdAt));

  return rows.map((r) => ({
    displayName: r.publishDisplayName!,
    rating: r.rating,
    text: r.text,
  }));
}
