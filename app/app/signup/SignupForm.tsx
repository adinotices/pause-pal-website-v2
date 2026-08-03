"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import AvailabilityGrid from "./AvailabilityGrid";
import { submitSignupAction, type SignupFormState } from "./actions";
import { COMMON_TIMEZONES, guessTimezone } from "@/lib/time";
import type { AvailabilityInput } from "@/lib/db/queries";

const STEPS = ["You", "Availability", "Preferences", "Commitment"] as const;

/** Which step each server-validated field lives on -- used to jump the
 * user to the earliest step with an error after a failed submission.
 * Without this, a field error on e.g. step 0 renders inside a `hidden`
 * section while the user is still looking at step 3, so all they see is
 * the generic "fix the highlighted fields" banner with nothing visibly
 * highlighted. */
const STEP_BY_FIELD: Record<string, number> = {
  firstName: 0,
  email: 0,
  timezone: 0,
  availability: 1,
  sessionsPerWeek: 2,
  sessionLength: 2,
  experienceLevel: 2,
  ownGenderIdentity: 2,
  partnerGenderPreference: 2,
  notes: 2,
  agreedToCommitment: 3,
};

const initialState: SignupFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Submit signup"}
    </button>
  );
}

export default function SignupForm({ cohortNumber }: { cohortNumber: number }) {
  const [state, formAction] = useActionState(submitSignupAction, initialState);
  const [step, setStep] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("");

  // Intl reads the *server's* timezone during SSR, not the browser's, so
  // this must run client-side post-hydration rather than as an initializer
  // (which would mismatch between server- and client-rendered markup).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(guessTimezone());
  }, []);

  useEffect(() => {
    if (!state.fieldErrors) return;
    const erroredSteps = Object.keys(state.fieldErrors).map((field) => STEP_BY_FIELD[field] ?? 0);
    if (erroredSteps.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(Math.min(...erroredSteps));
  }, [state.fieldErrors]);
  const [availability, setAvailability] = useState<AvailabilityInput[]>([]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [sessionLength, setSessionLength] = useState("15");
  const [ownGenderIdentity, setOwnGenderIdentity] = useState("");
  const [partnerGenderPreference, setPartnerGenderPreference] = useState("");
  const [partnerGenderIsHardRequirement, setPartnerGenderIsHardRequirement] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState("new");
  const [notes, setNotes] = useState("");
  const [agreedToCommitment, setAgreedToCommitment] = useState(false);

  const timezoneOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    if (timezone) set.add(timezone);
    return Array.from(set).sort();
  }, [timezone]);

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-semibold text-emerald-900">You&apos;re signed up!</h2>
        <p className="mt-2 text-emerald-800">
          Thanks, {firstName || "friend"}. We&apos;ll email you at {email} once matches for Cohort{" "}
          {cohortNumber} are finalized.
        </p>
      </div>
    );
  }

  const canAdvance = [
    firstName.trim().length > 0 && email.trim().length > 0 && timezone.length > 0,
    availability.length > 0,
    true,
    agreedToCommitment,
  ];

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="availability" value={JSON.stringify(availability)} />

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={`rounded-full px-3 py-1 ${
                i === step
                  ? "bg-emerald-600 text-white"
                  : i < step
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {state.status === "error" && state.message && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" aria-live="polite">
          {state.message}
        </p>
      )}

      {/* Step 0: You */}
      <section className={step === 0 ? "space-y-4" : "hidden"}>
        <div>
          <label className="block text-sm font-medium" htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            required
            maxLength={100}
          />
          {state.fieldErrors?.firstName && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.firstName}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            required
          />
          {state.fieldErrors?.email && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="timezone">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            We guessed this from your browser — double check it&apos;s right.
          </p>
        </div>
      </section>

      {/* Step 1: Availability */}
      <section className={step === 1 ? "space-y-4" : "hidden"}>
        <AvailabilityGrid onChange={setAvailability} />
        {state.fieldErrors?.availability && (
          <p className="text-sm text-red-600">{state.fieldErrors.availability}</p>
        )}
      </section>

      {/* Step 2: Preferences */}
      <section className={step === 2 ? "space-y-4" : "hidden"}>
        <div>
          <label className="block text-sm font-medium" htmlFor="sessionsPerWeek">
            How many times per week do you want to meditate with your pal?
          </label>
          <input
            id="sessionsPerWeek"
            name="sessionsPerWeek"
            type="number"
            min={1}
            max={7}
            value={sessionsPerWeek}
            onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
            className="mt-1 w-24 rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="sessionLength">
            Preferred session length
          </label>
          <select
            id="sessionLength"
            name="sessionLength"
            value={sessionLength}
            onChange={(e) => setSessionLength(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="30_plus">30+ minutes</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="experienceLevel">
            Meditation experience
          </label>
          <select
            id="experienceLevel"
            name="experienceLevel"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="new">New to meditation</option>
            <option value="some_experience">Some experience</option>
            <option value="experienced">Experienced</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="ownGenderIdentity">
            Your gender identity (optional)
          </label>
          <input
            id="ownGenderIdentity"
            name="ownGenderIdentity"
            value={ownGenderIdentity}
            onChange={(e) => setOwnGenderIdentity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="partnerGenderPreference">
            Preferred gender identity of your meditation partner (optional)
          </label>
          <input
            id="partnerGenderPreference"
            name="partnerGenderPreference"
            value={partnerGenderPreference}
            onChange={(e) => setPartnerGenderPreference(e.target.value)}
            placeholder="e.g. no preference, woman, man, non-binary"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            maxLength={200}
          />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="partnerGenderIsHardRequirement"
              checked={partnerGenderIsHardRequirement}
              onChange={(e) => setPartnerGenderIsHardRequirement(e.target.checked)}
            />
            This is a requirement, not just a preference
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="notes">
            Anything else we should know? (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            maxLength={2000}
          />
        </div>
      </section>

      {/* Step 3: Commitment */}
      <section className={step === 3 ? "space-y-4" : "hidden"}>
        <div className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">
          <p>
            PausePal pairs you with a meditation accountability buddy for a 4-week program. By
            signing up, you&apos;re committing to show up for your scheduled sessions, communicate
            with your pal if your availability changes, and give the practice an honest try.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="agreedToCommitment"
            checked={agreedToCommitment}
            onChange={(e) => setAgreedToCommitment(e.target.checked)}
            className="mt-1"
          />
          I agree to commit to the 4-week program as described above.
        </label>
        {state.fieldErrors?.agreedToCommitment && (
          <p className="text-sm text-red-600">{state.fieldErrors.agreedToCommitment}</p>
        )}
      </section>

      <div className="flex justify-between border-t border-neutral-200 pt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`rounded-full px-5 py-2 text-sm font-medium ${
            step === 0 ? "invisible" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canAdvance[step]}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="rounded-full bg-neutral-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}
