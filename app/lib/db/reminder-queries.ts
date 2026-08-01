import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { cohorts, matches, sentReminders, signups } from "./schema";
import { allOccurrences } from "@/lib/scheduling/instants";
import { sendEmail } from "@/lib/email/resend";
import {
  cohortStartsTomorrowEmail,
  feedbackAskEmail,
  sessionReminderEmail,
} from "@/lib/email/templates";
import { formatInstantForTimezone } from "@/lib/time";
import { getAppUrl } from "@/lib/site-url";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Records that a reminder went out, relying on the DB's unique
 * constraint (not an application-level check) to make this race-safe --
 * returns true only if this call actually inserted the row (i.e. it's the
 * first time), false if it was already sent. */
async function tryRecordSent(
  kind: string,
  referenceId: number,
  occurrenceDate: string,
): Promise<boolean> {
  const inserted = await db
    .insert(sentReminders)
    .values({ kind, referenceId, occurrenceDate })
    .onConflictDoNothing()
    .returning();
  return inserted.length > 0;
}

export type ReminderResult = { emailsSent: number };

/** Emails everyone whose match has a session occurring on `targetDate`
 * (normally "tomorrow", passed in by the caller). */
export async function sendSessionReminders(targetDate: Date): Promise<ReminderResult> {
  const targetISO = toISODate(targetDate);
  let emailsSent = 0;

  const approvedMatches = await db.query.matches.findMany({
    where: eq(matches.status, "approved"),
    with: {
      members: { with: { signup: { with: { person: true } } } },
      sessions: true,
    },
  });

  for (const match of approvedMatches) {
    for (const session of match.sessions) {
      const occurrence = allOccurrences(session.firstOccurrenceAt, session.weekCount).find(
        (o) => toISODate(o) === targetISO,
      );
      if (!occurrence) continue;

      const isFirstSend = await tryRecordSent("session_reminder", session.id, targetISO);
      if (!isFirstSend) continue;

      for (const member of match.members) {
        const recipient = member.signup.person;
        const partnerFirstNames = match.members
          .filter((m) => m.signup.personId !== recipient.id)
          .map((m) => m.signup.person.firstName);

        const { subject, html, text } = sessionReminderEmail({
          firstName: recipient.firstName,
          partnerFirstNames,
          whenLocal: formatInstantForTimezone(occurrence, recipient.timezone),
          zoomJoinUrl: match.zoomJoinUrl,
        });
        await sendEmail({ to: recipient.email, subject, html, text });
        emailsSent++;
      }
    }
  }

  return { emailsSent };
}

/** Emails every matched participant in a cohort starting on `targetDate`
 * (normally "tomorrow"). */
export async function sendCohortStartReminders(targetDate: Date): Promise<ReminderResult> {
  const targetISO = toISODate(targetDate);
  let emailsSent = 0;

  const dueCohorts = await db.select().from(cohorts).where(eq(cohorts.startsOn, targetISO));
  for (const cohort of dueCohorts) {
    const isFirstSend = await tryRecordSent("cohort_starts_tomorrow", cohort.id, targetISO);
    if (!isFirstSend) continue;

    const matchedSignups = await db.query.signups.findMany({
      where: and(eq(signups.cohortId, cohort.id), eq(signups.status, "matched")),
      with: { person: true },
    });
    for (const s of matchedSignups) {
      const { subject, html, text } = cohortStartsTomorrowEmail({
        firstName: s.person.firstName,
        cohortNumber: cohort.number,
      });
      await sendEmail({ to: s.person.email, subject, html, text });
      emailsSent++;
    }
  }

  return { emailsSent };
}

/** Emails every matched participant in a cohort that ended on
 * `targetDate` (normally "yesterday"), asking for feedback. */
export async function sendFeedbackAskReminders(targetDate: Date): Promise<ReminderResult> {
  const targetISO = toISODate(targetDate);
  let emailsSent = 0;

  const dueCohorts = await db.select().from(cohorts).where(eq(cohorts.endsOn, targetISO));
  for (const cohort of dueCohorts) {
    const isFirstSend = await tryRecordSent("feedback_ask", cohort.id, targetISO);
    if (!isFirstSend) continue;

    const matchedSignups = await db.query.signups.findMany({
      where: and(eq(signups.cohortId, cohort.id), eq(signups.status, "matched")),
      with: { person: true },
    });
    for (const s of matchedSignups) {
      const { subject, html, text } = feedbackAskEmail({
        firstName: s.person.firstName,
        feedbackUrl: `${getAppUrl()}/feedback`,
      });
      await sendEmail({ to: s.person.email, subject, html, text });
      emailsSent++;
    }
  }

  return { emailsSent };
}
