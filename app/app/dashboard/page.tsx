import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPersonId } from "@/lib/current-participant";
import { getDashboardDataForPerson } from "@/lib/db/participant-queries";
import { formatInstantForTimezone } from "@/lib/time";
import { participantLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const personId = await getCurrentPersonId();
  if (!personId) redirect("/login");

  const data = await getDashboardDataForPerson(personId);
  if (!data) redirect("/login");

  const { person, signup, cohort, match, partners } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hi {person.firstName}</h1>
        <form action={participantLogoutAction}>
          <button type="submit" className="text-sm text-neutral-500 underline">
            Log out
          </button>
        </form>
      </div>

      {!signup && (
        <div className="mt-8 rounded-xl border border-neutral-200 p-6 text-center">
          <p className="text-neutral-600">You haven&apos;t signed up for a cohort yet.</p>
          <Link
            href="/signup"
            className="mt-4 inline-block rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Sign up
          </Link>
        </div>
      )}

      {signup && cohort && (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-neutral-200 p-6">
            <h2 className="font-medium">Cohort {cohort.number}</h2>
            {!match && (
              <p className="mt-2 text-sm text-neutral-600">
                Your signup is in. We&apos;ll email you once matches are finalized.
              </p>
            )}
            {match && (
              <>
                <p className="mt-2 text-sm text-neutral-600">
                  Matched with{" "}
                  {partners.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && " & "}
                      <span className="font-medium">{p.firstName}</span> (
                      <a href={`mailto:${p.email}`} className="underline">
                        {p.email}
                      </a>
                      )
                    </span>
                  ))}
                </p>

                {match.zoomJoinUrl ? (
                  <a
                    href={match.zoomJoinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Join on Zoom
                  </a>
                ) : (
                  <p className="mt-3 text-sm text-amber-700">
                    Your schedule is still being finalized -- check back soon.
                  </p>
                )}

                {match.sessions.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-neutral-700">Weekly sessions</h3>
                    <ul className="mt-1 space-y-1 text-sm text-neutral-600">
                      {match.sessions.map((s) => (
                        <li key={s.id}>
                          {formatInstantForTimezone(s.firstOccurrenceAt, person.timezone)} (
                          {person.timezone})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link
                  href="/feedback"
                  className="mt-4 inline-block text-sm text-emerald-700 underline"
                >
                  Share feedback about your experience
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
