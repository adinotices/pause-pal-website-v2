import Link from "next/link";
import { listFeedbackForAdmin } from "@/lib/db/feedback-queries";
import { setPublicationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TestimonialsPage() {
  const allFeedback = await listFeedbackForAdmin();
  const consented = allFeedback.filter((f) => f.consentToPublish);
  const notConsented = allFeedback.filter((f) => !f.consentToPublish);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin" className="text-sm text-neutral-500 underline">
        ← Admin
      </Link>
      <h1 className="mt-1 text-2xl font-semibold">Testimonials</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Feedback where the participant consented to publishing. Set a display name (e.g. first
        name only, or &ldquo;First L.&rdquo;) and publish to make it appear in the public
        testimonials API.
      </p>

      <section className="mt-8 space-y-4">
        {consented.map((f) => (
          <div key={f.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{f.firstName}</span>{" "}
                <span className="text-sm text-neutral-400">
                  Cohort {f.cohortNumber} · {"★".repeat(f.rating)}
                  {"☆".repeat(5 - f.rating)}
                </span>
              </div>
              {f.published && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                  published
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-neutral-700">{f.text}</p>

            <form action={setPublicationAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="feedbackId" value={f.id} />
              <input
                type="text"
                name="publishDisplayName"
                defaultValue={f.publishDisplayName ?? f.firstName}
                placeholder="Display name"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              />
              {f.published ? (
                <button
                  type="submit"
                  name="published"
                  value="false"
                  className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium hover:bg-neutral-200"
                >
                  Unpublish
                </button>
              ) : (
                <button
                  type="submit"
                  name="published"
                  value="true"
                  className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Publish
                </button>
              )}
            </form>
          </div>
        ))}
        {consented.length === 0 && (
          <p className="text-neutral-500">No feedback with publish consent yet.</p>
        )}
      </section>

      {notConsented.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium text-neutral-500">
            Feedback without publish consent ({notConsented.length})
          </h2>
          <div className="mt-3 space-y-2">
            {notConsented.map((f) => (
              <div key={f.id} className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                <span className="font-medium">{f.firstName}</span> · Cohort {f.cohortNumber} ·{" "}
                {"★".repeat(f.rating)}
                {"☆".repeat(5 - f.rating)} -- {f.text}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
