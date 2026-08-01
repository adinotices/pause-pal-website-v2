"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PARTICIPANT_SESSION_COOKIE } from "@/lib/participant-auth";

export async function participantLogoutAction() {
  const store = await cookies();
  store.delete(PARTICIPANT_SESSION_COOKIE);
  redirect("/login");
}
