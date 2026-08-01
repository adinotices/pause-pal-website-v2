"use server";

import { z } from "zod";
import { getOpenCohort, submitSignup, SignupAlreadyFinalizedError } from "@/lib/db/queries";

const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  timezone: z.string().min(1),
  availability: z.array(availabilitySchema).min(1, "Select at least one available time"),
  sessionsPerWeek: z.number().int().min(1).max(7),
  sessionLength: z.enum(["5", "10", "15", "20", "30", "30_plus"]),
  ownGenderIdentity: z.string().trim().max(200),
  partnerGenderPreference: z.string().trim().max(200),
  partnerGenderIsHardRequirement: z.boolean(),
  experienceLevel: z.enum(["new", "some_experience", "experienced"]),
  notes: z.string().trim().max(2000),
  agreedToCommitment: z.literal(true, {
    error: "You must agree to the commitment to sign up",
  }),
});

export type SignupFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function submitSignupAction(
  _prevState: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    email: String(formData.get("email") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    availability: JSON.parse(String(formData.get("availability") ?? "[]")),
    sessionsPerWeek: Number(formData.get("sessionsPerWeek")),
    sessionLength: String(formData.get("sessionLength") ?? ""),
    ownGenderIdentity: String(formData.get("ownGenderIdentity") ?? ""),
    partnerGenderPreference: String(formData.get("partnerGenderPreference") ?? ""),
    partnerGenderIsHardRequirement: formData.get("partnerGenderIsHardRequirement") === "on",
    experienceLevel: String(formData.get("experienceLevel") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    agreedToCommitment: formData.get("agreedToCommitment") === "on",
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const cohort = await getOpenCohort();
  if (!cohort) {
    return {
      status: "error",
      message: "Signups are currently closed. Check back soon or subscribe to our newsletter.",
    };
  }

  try {
    await submitSignup({ cohortId: cohort.id, ...parsed.data });
  } catch (err) {
    if (err instanceof SignupAlreadyFinalizedError) {
      return {
        status: "error",
        message:
          "You've already been matched for this cohort, so this form can no longer make changes. Email hello@pausepal.co if something needs to change.",
      };
    }
    console.error("submitSignup failed", err);
    return {
      status: "error",
      message: "Something went wrong saving your signup. Please try again.",
    };
  }

  return { status: "success" };
}
