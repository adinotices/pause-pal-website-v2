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

async function wasAlreadySent(
  kind: string,
  referenceId: number,
  occurrenceDate: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: sentReminders.id })
    .from(sentReminders)
    .where(
      and(
        eq(sentReminders.kind, kind),
        eq(sentReminders.referenceId, referenceId),
        eq(sentReminders.occurrenceDate, occurrenceDate),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Records a reminder batch as sent. Relies on the DB's unique constraint
 * (not an application-level check) as the actual race guard -- called
 * only *after* every email in the batch has gone out successfully (see
 * each send function below), so a batch that throws partway through is
 * never recorded and will be retried in full on the next invocation. That
 * trades "a batch that partially succeeded then failed might re-send to
 * whoever already got it" for "a transient failure doesn't silently and
 * permanently lose that reminder" -- an occasional duplicate reminder is
 * far less bad than nobody hearing about it at all. This app runs the
 * reminder job as a single daily cron invocation with no expected
 * concurrency, so the read-then-send-then-write pattern here doesn't need
 * to be atomic against a second, simultaneous run. */
async function recordSent(kind: string, referenceId: number, occurrenceDate: string): Promise<void> {
  await db.insert(sentReminders).values({ kind, referenceId, occurrenceDate }).onConflictDoNothing();
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
      if (await wasAlreadySent("session_reminder", session.id, targetISO)) continue;

      try {
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
        await recordSent("session_reminder", session.id, targetISO);
      } catch (err) {
        console.error(`Failed to send session reminder for session ${session.id}`, err);
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
    if (await wasAlreadySent("cohort_starts_tomorrow", cohort.id, targetISO)) continue;

    try {
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
      await recordSent("cohort_starts_tomorrow", cohort.id, targetISO);
    } catch (err) {
      console.error(`Failed to send cohort-start reminders for cohort ${cohort.id}`, err);
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
    if (await wasAlreadySent("feedback_ask", cohort.id, targetISO)) continue;

    try {
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
      await recordSent("feedback_ask", cohort.id, targetISO);
    } catch (err) {
      console.error(`Failed to send feedback-ask reminders for cohort ${cohort.id}`, err);
    }
  }

  return { emailsSent };
}
