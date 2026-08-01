"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitFeedbackAction, type FeedbackFormState } from "./actions";

const initialState: FeedbackFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Submit feedback"}
    </button>
  );
}

export default function FeedbackForm({
  initialRating,
  initialText,
  initialConsent,
}: {
  initialRating: number;
  initialText: string;
  initialConsent: boolean;
}) {
  const [state, formAction] = useActionState(submitFeedbackAction, initialState);
  const [rating, setRating] = useState(initialRating || 5);

  if (state.status === "success") {
    return (
      <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
        Thanks for sharing! Your feedback means a lot.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.message}</p>
      )}

      <div>
        <span className="block text-sm font-medium">Rating</span>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className={`text-2xl ${n <= rating ? "text-amber-500" : "text-neutral-300"}`}
            >
              ★
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </div>

      <div>
        <label htmlFor="text" className="block text-sm font-medium">
          Tell us about your experience
        </label>
        <textarea
          id="text"
          name="text"
          required
          rows={5}
          defaultValue={initialText}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="consentToPublish"
          defaultChecked={initialConsent}
          className="mt-1"
        />
        You may use this as a testimonial on the PausePal website (we&apos;ll choose how it&apos;s
        attributed, e.g. first name and last initial).
      </label>

      <SubmitButton />
    </form>
  );
}
