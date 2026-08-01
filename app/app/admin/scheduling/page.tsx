import Link from "next/link";
import { listCohorts } from "@/lib/db/queries";
import { previewScheduleForCohort } from "@/lib/db/scheduling-queries";
import { isGoogleCalendarConfigured, isZoomConfigured } from "@/lib/integrations/config";
import { formatInstantForTimezone } from "@/lib/time";
import SendButton from "./SendButton";

export const dynamic = "force-dynamic";

export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort: cohortParam } = await searchParams;
  const allCohorts = await listCohorts();
  const selected =
    allCohorts.find((c) => c.number === Number(cohortParam)) ??
    allCohorts.find((c) => c.state === "matched" || c.state === "scheduled") ??
    allCohorts[0] ??
    null;

  const previews = selected ? await previewScheduleForCohort(selected.id) : [];
  const zoomOk = isZoomConfigured();
  const calendarOk = isGoogleCalendarConfigured();
  const anyUnscheduled = previews.some((p) => !p.alreadyScheduled);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <Link href="/admin" className="text-sm text-neutral-500 underline">
          ← Admin
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Scheduling</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Preview computed session times for every approved match, then send calendar invites
          with a Zoom link attached.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {allCohorts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/scheduling?cohort=${c.number}`}
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
          <div className="mt-6 flex flex-wrap gap-3">
            <ConfigBadge label="Zoom" ok={zoomOk} />
            <ConfigBadge label="Google Calendar" ok={calendarOk} />
          </div>
          {(!zoomOk || !calendarOk) && (
            <p className="mt-2 text-sm text-neutral-500">
              Sending still computes and stores session times either way -- it just skips
              creating a Zoom meeting and/or calendar events for whichever integration isn&apos;t
              configured. See app/README.md for setup.
            </p>
          )}

          <section className="mt-8 space-y-4">
            {previews.map((p) => (
              <div key={p.matchId} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.topic}</span>
                    {p.alreadyScheduled && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                        scheduled
                      </span>
                    )}
                  </div>
                  {p.zoomJoinUrl && (
                    <a
                      href={p.zoomJoinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-emerald-700 underline"
                    >
                      Zoom link
                    </a>
                  )}
                </div>

                {p.sessions.length === 0 ? (
                  <p className="mt-2 text-sm text-amber-700">
                    No shared session time could be computed for this match -- needs manual
                    attention.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {p.sessions.map((s, i) => (
                      <div key={i} className="text-sm text-neutral-700">
                        {p.members.map((m) => (
                          <div key={m.email}>
                            <span className="text-neutral-500">{m.firstName}: </span>
                            {formatInstantForTimezone(s.firstOccurrenceAt, m.timezone)}
                            <span className="text-neutral-400"> ({m.timezone})</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    <p className="text-xs text-neutral-400">
                      Repeats weekly for {p.weekCount} week{p.weekCount === 1 ? "" : "s"}.
                    </p>
                  </div>
                )}
              </div>
            ))}
            {previews.length === 0 && (
              <p className="text-neutral-500">No approved matches for this cohort yet.</p>
            )}
          </section>

          {previews.length > 0 && (
            <div className="mt-6">
              <SendButton cohortNumber={selected.number} disabled={!anyUnscheduled} />
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ConfigBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {label}: {ok ? "configured" : "not configured"}
    </span>
  );
}
