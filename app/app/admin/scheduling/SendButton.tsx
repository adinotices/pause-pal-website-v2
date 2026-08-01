"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { sendScheduleAction, type SendScheduleState } from "./actions";

const initialState: SendScheduleState = { status: "idle" };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
    >
      {pending ? "Sending…" : "Send calendar invites + create Zoom links"}
    </button>
  );
}

export default function SendButton({
  cohortNumber,
  disabled,
}: {
  cohortNumber: number;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(sendScheduleAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "done") {
      // The preview above was rendered from data that's now stale (matches
      // just got scheduled) -- refresh the server-rendered data in place.
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="cohortNumber" value={cohortNumber} />
        <SubmitButton disabled={disabled} />
      </form>
      {state.status === "done" && (
        <div className="mt-3 space-y-1 text-sm">
          {(state.results ?? []).length === 0 && (
            <p className="text-neutral-500">Nothing to send.</p>
          )}
          {state.results?.map((r) => (
            <p
              key={r.matchId}
              className={r.status === "error" ? "text-red-600" : "text-neutral-600"}
            >
              Match #{r.matchId}: {r.status.replace(/_/g, " ")}
              {r.zoomCreated && " · Zoom meeting created"}
              {r.calendarEventsCreated > 0 && ` · ${r.calendarEventsCreated} calendar event(s) created`}
              {r.error && ` · ${r.error}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
