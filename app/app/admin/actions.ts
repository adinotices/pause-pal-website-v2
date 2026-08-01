"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, signSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { cohorts } from "@/lib/db/schema";

export type LoginState = { status: "idle" | "error"; message?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!password || !verifyPassword(password)) {
    return { status: "error", message: "Incorrect password" };
  }

  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(String(formData.get("next") || "/admin"));
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

const createCohortSchema = z.object({
  number: z.coerce.number().int().positive(),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
});

/** Creates a new cohort in the `open` state and closes any cohort that was
 * previously open. Phase 1 assumes at most one open cohort at a time. */
export async function createCohortAction(formData: FormData) {
  const parsed = createCohortSchema.parse({
    number: formData.get("number"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });

  await db.transaction(async (tx) => {
    await tx
      .update(cohorts)
      .set({ state: "closed" })
      .where(eq(cohorts.state, "open"));

    await tx.insert(cohorts).values({
      number: parsed.number,
      state: "open",
      startsOn: parsed.startsOn,
      endsOn: parsed.endsOn,
      signupOpensAt: new Date(),
    });
  });

  redirect("/admin");
}

export async function closeCohortAction(formData: FormData) {
  const cohortId = Number(formData.get("cohortId"));
  await db.update(cohorts).set({ state: "closed" }).where(eq(cohorts.id, cohortId));
  redirect("/admin");
}
