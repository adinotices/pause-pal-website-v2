import { NextRequest, NextResponse } from "next/server";
import {
  sendCohortStartReminders,
  sendFeedbackAskReminders,
  sendSessionReminders,
} from "@/lib/db/reminder-queries";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * once CRON_SECRET is set as a project env var -- see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 * In local dev, with no CRON_SECRET configured, the check is skipped
 * (there's nothing meaningful to compare against, and requiring a fake
 * secret would just get hardcoded into test scripts). */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const yesterday = new Date(now.getTime() - DAY_MS);

  const [sessionReminders, cohortStartReminders, feedbackAskReminders] = await Promise.all([
    sendSessionReminders(tomorrow),
    sendCohortStartReminders(tomorrow),
    sendFeedbackAskReminders(yesterday),
  ]);

  return NextResponse.json({ sessionReminders, cohortStartReminders, feedbackAskReminders });
}
