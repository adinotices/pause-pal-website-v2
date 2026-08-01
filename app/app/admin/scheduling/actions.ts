"use server";

import { getCohortByNumber } from "@/lib/db/queries";
import { sendScheduleForCohort, type SendScheduleResult } from "@/lib/db/scheduling-queries";

export type SendScheduleState = {
  status: "idle" | "done";
  results?: SendScheduleResult[];
};

export async function sendScheduleAction(
  _prevState: SendScheduleState,
  formData: FormData,
): Promise<SendScheduleState> {
  const cohortNumber = Number(formData.get("cohortNumber"));
  const cohort = await getCohortByNumber(cohortNumber);
  if (!cohort) return { status: "done", results: [] };

  const results = await sendScheduleForCohort(cohort.id);
  return { status: "done", results };
}
