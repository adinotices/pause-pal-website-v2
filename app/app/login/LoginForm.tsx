"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestMagicLinkAction, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Sending…" : "Email me a sign-in link"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(requestMagicLinkAction, initialState);

  if (state.status === "sent") {
    return (
      <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
        If that email is signed up with PausePal, we&apos;ve sent a sign-in link to it. The link
        expires in 30 minutes.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
