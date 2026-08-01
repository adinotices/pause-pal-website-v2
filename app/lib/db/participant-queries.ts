import { eq } from "drizzle-orm";
import { db } from "./index";
import { people, signups } from "./schema";

/** Everything the participant dashboard needs for one person: their most
 * relevant signup, that cohort, and -- if matched -- their match,
 * partner(s), and computed session times.
 *
 * "Most relevant" prefers a `matched` signup over a merely `submitted`
 * one, even if the submitted one is more recent -- someone who's matched
 * in an active cohort came here to see that, not "your signup is in" for
 * a newer cohort they also happen to be in the pool for. Ties within the
 * same status break on most-recently-submitted. */
export async function getDashboardDataForPerson(personId: number) {
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return null;

  const allSignups = await db.query.signups.findMany({
    where: eq(signups.personId, personId),
    orderBy: (s, { desc }) => desc(s.submittedAt),
    with: {
      cohort: true,
      preferences: true,
      feedback: true,
      matchMembership: {
        with: {
          match: {
            with: {
              members: { with: { signup: { with: { person: true } } } },
              sessions: true,
            },
          },
        },
      },
    },
  });

  const signup =
    allSignups.find((s) => s.status === "matched") ?? allSignups[0] ?? null;

  if (!signup) return { person, signup: null as null, cohort: null, match: null, partners: [] };

  const match = signup.matchMembership?.match ?? null;
  const partners = (match?.members ?? [])
    .filter((m) => m.signup.personId !== personId)
    .map((m) => m.signup.person);

  return { person, signup, cohort: signup.cohort, match, partners };
}
