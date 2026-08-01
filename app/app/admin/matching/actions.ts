"use server";

import { redirect } from "next/navigation";
import {
  approveMatchesForCohort,
  deleteProposedMatch,
  generateProposalsForCohort,
  setMatchPinned,
} from "@/lib/db/matching-queries";
import { getCohortByNumber } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

async function requireCohort(cohortNumber: number) {
  const cohort = await getCohortByNumber(cohortNumber);
  if (!cohort) throw new Error(`Cohort ${cohortNumber} not found`);
  return cohort;
}

export async function generateProposalsAction(formData: FormData) {
  await requireAdmin();
  const cohortNumber = Number(formData.get("cohortNumber"));
  const cohort = await requireCohort(cohortNumber);
  await generateProposalsForCohort(cohort.id);
  redirect(`/admin/matching?cohort=${cohortNumber}`);
}

export async function togglePinAction(formData: FormData) {
  await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const pinned = formData.get("pinned") === "true";
  const cohortNumber = Number(formData.get("cohortNumber"));
  await setMatchPinned(matchId, pinned);
  redirect(`/admin/matching?cohort=${cohortNumber}`);
}

export async function deleteMatchAction(formData: FormData) {
  await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const cohortNumber = Number(formData.get("cohortNumber"));
  await deleteProposedMatch(matchId);
  redirect(`/admin/matching?cohort=${cohortNumber}`);
}

export async function approveAllAction(formData: FormData) {
  await requireAdmin();
  const cohortNumber = Number(formData.get("cohortNumber"));
  const cohort = await requireCohort(cohortNumber);
  await approveMatchesForCohort(cohort.id);
  redirect(`/admin/matching?cohort=${cohortNumber}`);
}
