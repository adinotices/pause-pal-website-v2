import { getOpenCohort } from "@/lib/db/queries";
import SignupForm from "./SignupForm";

export const metadata = {
  title: "Sign up — PausePal",
};

// Whether signups are open depends on live DB state, not anything knowable
// at build time.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const cohort = await getOpenCohort();

  if (!cohort) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Signups are currently closed</h1>
        <p className="mt-3 text-neutral-600">
          We&apos;re not running a cohort right now. Subscribe to the{" "}
          <a
            href="https://pausepal.substack.com/"
            className="text-emerald-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            PausePal newsletter
          </a>{" "}
          to hear when the next one opens.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Sign up for Cohort {cohort.number}</h1>
      <p className="mt-2 text-neutral-600">
        Tell us about your availability and preferences, and we&apos;ll match you with a
        meditation accountability partner.
      </p>
      <div className="mt-8">
        <SignupForm cohortNumber={cohort.number} />
      </div>
    </main>
  );
}
