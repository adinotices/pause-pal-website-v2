"use server";

import { redirect } from "next/navigation";
import { setFeedbackPublication } from "@/lib/db/feedback-queries";
import { requireAdmin } from "@/lib/require-admin";

export async function setPublicationAction(formData: FormData) {
  await requireAdmin();
  const feedbackId = Number(formData.get("feedbackId"));
  const published = formData.get("published") === "true";
  const publishDisplayName = String(formData.get("publishDisplayName") ?? "").trim();

  await setFeedbackPublication(feedbackId, { published, publishDisplayName });
  redirect("/admin/testimonials");
}
