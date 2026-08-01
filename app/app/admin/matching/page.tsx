import Link from "next/link";
import { listCohorts } from "@/lib/db/queries";
import {
  listMatchesForCohort,
  listUnmatchedSignupsForCohort,
} from "@/lib/db/matching-queries";
import {
  approveAllAction,
  deleteMatchAction,
  generateProposalsAction,
  togglePinAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort: cohortParam } = await searchParams;
  const allCohorts = await listCohorts();
  const selected =
    allCohorts.find((c) => c.number === Number(cohortParam)) ??
    allCohorts.find((c) => c.state === "open" || c.state === "closed" || c.state === "matching") ??
    allCohorts[0] ??
    null;

  const matches = selected ? await listMatchesForCohort(selected.id) : [];
  const unmatched = selected ? await listUnmatchedSignupsForCohort(selected.id) : [];

  const proposed = matches.filter((m) => m.status === "proposed");
  const approved = matches.filter((m) => m.status === "approved");
  const isFinalized = selected?.state === "matched" || selected?.state === "scheduled" || selected?.state === "running" || selected?.state === "complete";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-neutral-500 underline">
            ← Admin
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Matching</h1>
        </div>
        <Link
          href={`/admin/scheduling${selected ? `?cohort=${selected.number}` : ""}`}
          className="text-sm text-emerald-700 underline"
        >
          Scheduling →
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {allCohorts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/matching?cohort=${c.number}`}
            className={`rounded-full px-3 py-1 text-sm ${
              selected?.id === c.id
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            Cohort {c.number} · {c.state}
          </Link>
        ))}
      </div>

      {!selected && <p className="mt-8 text-neutral-500">No cohorts yet.</p>}

      {selected && (
        <>
          {!selected.startsOn && (
            <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              This cohort has no start date, so proposals can&apos;t be generated yet (matching
              needs a real date to resolve everyone&apos;s timezone correctly around DST). Set one
              from the admin cohort screen.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form action={generateProposalsAction}>
              <input type="hidden" name="cohortNumber" value={selected.number} />
              <button
                type="submit"
                disabled={!selected.startsOn || isFinalized}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {proposed.length > 0 || approved.length > 0
                  ? "Regenerate proposals"
                  : "Generate proposals"}
              </button>
            </form>
            {proposed.length > 0 && !isFinalized && (
              <form action={approveAllAction}>
                <input type="hidden" name="cohortNumber" value={selected.number} />
                <button
                  type="submit"
                  className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  Approve all proposed matches
                </button>
              </form>
            )}
            <p className="text-sm text-neutral-500">
              Regenerating keeps pinned matches as-is and only re-solves everyone else.
            </p>
          </div>

          {isFinalized && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              This cohort&apos;s matches are finalized. Regeneration and approval are disabled.
            </p>
          )}

          <section className="mt-8">
            <h2 className="font-medium">
              {isFinalized ? "Approved matches" : "Proposed matches"} ({matches.length})
            </h2>
            <div className="mt-3 space-y-3">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-neutral-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {m.members.map((member) => (
                          <span
                            key={member.signupId}
                            className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium"
                          >
                            {member.firstName}
                          </span>
                        ))}
                        <span className="text-sm text-neutral-400">
                          score {m.score.toFixed(0)}
                        </span>
                        {m.pinned && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            pinned
                          </span>
                        )}
                        {m.status === "approved" && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                            approved
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">{m.explanation}</p>
                    </div>
                    {m.status === "proposed" && (
                      <div className="flex shrink-0 gap-2">
                        <form action={togglePinAction}>
                          <input type="hidden" name="matchId" value={m.id} />
                          <input type="hidden" name="cohortNumber" value={selected.number} />
                          <input type="hidden" name="pinned" value={(!m.pinned).toString()} />
                          <button
                            type="submit"
                            className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium hover:bg-neutral-200"
                          >
                            {m.pinned ? "Unpin" : "Pin"}
                          </button>
                        </form>
                        <form action={deleteMatchAction}>
                          <input type="hidden" name="matchId" value={m.id} />
                          <input type="hidden" name="cohortNumber" value={selected.number} />
                          <button
                            type="submit"
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="text-neutral-500">
                  No matches yet. Generate proposals to get started.
                </p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-medium">Unmatched ({unmatched.length})</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Submitted signups not currently part of any match. Usually either genuinely
              incompatible with everyone else&apos;s availability, or the odd one out this round --
              needs a human call (hold for next cohort, reach out to adjust availability, etc).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {unmatched.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900"
                  title={s.person.email}
                >
                  {s.person.firstName}
                </span>
              ))}
              {unmatched.length === 0 && (
                <p className="text-sm text-neutral-500">Everyone submitted is currently matched.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
