import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Lightweight liveness + DB-connectivity check for post-deploy
 * verification and uptime monitoring. Deliberately unauthenticated (it
 * reveals no data, just "is the app up and can it reach the database")
 * and cheap -- a single `SELECT 1`, not a real query against app tables. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
