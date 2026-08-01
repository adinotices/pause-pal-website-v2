"use server";

import { z } from "zod";
import { getCurrentPersonId } from "@/lib/current-participant";
import { getFeedbackTargetForPerson, submitFeedback } from "@/lib/db/feedback-queries";

export type FeedbackFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(1, "Please share at least a sentence").max(4000),
  consentToPublish: z.boolean(),
});

export async function submitFeedbackAction(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const personId = await getCurrentPersonId();
  if (!personId) {
    return { status: "error", message: "Please sign in again." };
  }

  const target = await getFeedbackTargetForPerson(personId);
  if (!target) {
    return {
      status: "error",
      message: "We couldn't find a completed match to attach feedback to.",
    };
  }

  const parsed = feedbackSchema.safeParse({
    rating: formData.get("rating"),
    text: formData.get("text"),
    consentToPublish: formData.get("consentToPublish") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await submitFeedback({ signupId: target.id, ...parsed.data });
  return { status: "success" };
}
