import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getCohortByNumber, listSignupsForCohort } from "@/lib/db/queries";
import { formatAvailability, SESSION_LENGTH_LABELS, EXPERIENCE_LABELS } from "@/lib/format";

function csvCell(value: string): string {
  // Most of these cells are free text a participant typed. Excel/Sheets
  // treat a leading =, +, -, @ (or a leading tab/CR) as the start of a
  // formula, so an unescaped cell is code the admin's spreadsheet runs on
  // open. Prefixing with an apostrophe forces it back to being text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function GET(request: NextRequest) {
  // Belt-and-suspenders: proxy.ts already gates /admin/:path*, but auth is
  // re-checked here per Next's guidance not to rely on Proxy alone.
  const authed = verifySession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cohortNumber = Number(request.nextUrl.searchParams.get("cohort"));
  const cohort = await getCohortByNumber(cohortNumber);
  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
  }

  const signups = await listSignupsForCohort(cohort.id);

  const header = [
    "first_name",
    "email",
    "timezone",
    "sessions_per_week",
    "session_length",
    "experience_level",
    "own_gender_identity",
    "partner_gender_preference",
    "partner_gender_is_hard_requirement",
    "availability",
    "notes",
    "submitted_at",
  ];

  const rows = signups.map((s) =>
    [
      s.person.firstName,
      s.person.email,
      s.person.timezone,
      String(s.preferences?.sessionsPerWeek ?? ""),
      s.preferences ? SESSION_LENGTH_LABELS[s.preferences.sessionLength] : "",
      s.preferences ? EXPERIENCE_LABELS[s.preferences.experienceLevel] : "",
      s.preferences?.ownGenderIdentity ?? "",
      s.preferences?.partnerGenderPreference ?? "",
      s.preferences?.partnerGenderIsHardRequirement ? "yes" : "no",
      formatAvailability(s.availabilitySlots),
      s.preferences?.notes ?? "",
      s.submittedAt.toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pausepal-cohort-${cohort.number}-signups.csv"`,
    },
  });
}
