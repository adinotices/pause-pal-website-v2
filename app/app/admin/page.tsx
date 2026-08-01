import Link from "next/link";
import { listCohorts, listSignupsForCohort } from "@/lib/db/queries";
import { formatAvailability, SESSION_LENGTH_LABELS, EXPERIENCE_LABELS } from "@/lib/format";
import { createCohortAction, closeCohortAction, logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort: cohortParam } = await searchParams;
  const allCohorts = await listCohorts();
  const selected =
    allCohorts.find((c) => c.number === Number(cohortParam)) ??
    allCohorts.find((c) => c.state === "open") ??
    allCohorts[0] ??
    null;

  const signups = selected ? await listSignupsForCohort(selected.id) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">PausePal admin</h1>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-neutral-500 underline">
            Log out
          </button>
        </form>
      </div>

      <section className="mt-8 rounded-xl border border-neutral-200 p-5">
        <h2 className="font-medium">Cohorts</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {allCohorts.map((c) => (
            <Link
              key={c.id}
              href={`/admin?cohort=${c.number}`}
              className={`rounded-full px-3 py-1 text-sm ${
                selected?.id === c.id
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              Cohort {c.number} · {c.state}
            </Link>
          ))}
          {allCohorts.length === 0 && (
            <p className="text-sm text-neutral-500">No cohorts yet — create the first one below.</p>
          )}
        </div>

        {selected?.state === "open" && (
          <form action={closeCohortAction} className="mt-4">
            <input type="hidden" name="cohortId" value={selected.id} />
            <button
              type="submit"
              className="rounded-full bg-red-50 px-4 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Close signups for Cohort {selected.number}
            </button>
          </form>
        )}

        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Open a new cohort
          </summary>
          <form action={createCohortAction} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600" htmlFor="number">
                Cohort number
              </label>
              <input
                id="number"
                name="number"
                type="number"
                required
                className="mt-1 w-28 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600" htmlFor="startsOn">
                Starts on
              </label>
              <input
                id="startsOn"
                name="startsOn"
                type="date"
                required
                className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600" htmlFor="endsOn">
                Ends on
              </label>
              <input
                id="endsOn"
                name="endsOn"
                type="date"
                required
                className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700"
            >
              Open cohort
            </button>
          </form>
          <p className="mt-2 text-xs text-neutral-500">
            Opening a new cohort automatically closes signups for whichever cohort is currently
            open.
          </p>
        </details>
      </section>

      {selected && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              Signups for Cohort {selected.number} ({signups.length})
            </h2>
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/matching?cohort=${selected.number}`}
                className="text-sm text-emerald-700 underline"
              >
                Matching →
              </Link>
              <a
                href={`/admin/export?cohort=${selected.number}`}
                className="text-sm text-emerald-700 underline"
              >
                Download CSV
              </a>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Timezone</th>
                  <th className="p-3">Freq / Length</th>
                  <th className="p-3">Experience</th>
                  <th className="p-3">Gender / Pref</th>
                  <th className="p-3">Availability</th>
                  <th className="p-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-100 align-top">
                    <td className="p-3 font-medium">{s.person.firstName}</td>
                    <td className="p-3">{s.person.email}</td>
                    <td className="p-3">{s.person.timezone}</td>
                    <td className="p-3">
                      {s.preferences?.sessionsPerWeek ?? "—"}×/wk ·{" "}
                      {s.preferences
                        ? SESSION_LENGTH_LABELS[s.preferences.sessionLength]
                        : "—"}
                    </td>
                    <td className="p-3">
                      {s.preferences ? EXPERIENCE_LABELS[s.preferences.experienceLevel] : "—"}
                    </td>
                    <td className="p-3">
                      {s.preferences?.ownGenderIdentity || "—"} →{" "}
                      {s.preferences?.partnerGenderPreference || "no preference"}
                      {s.preferences?.partnerGenderIsHardRequirement && (
                        <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          required
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs p-3">{formatAvailability(s.availabilitySlots)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {s.submittedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
                {signups.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-neutral-500">
                      No signups yet for this cohort.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
