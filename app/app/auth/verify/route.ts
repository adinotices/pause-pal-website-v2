import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLinkToken } from "@/lib/db/auth-queries";
import { PARTICIPANT_SESSION_COOKIE, signParticipantSession } from "@/lib/participant-auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const personId = await consumeMagicLinkToken(token);
  if (!personId) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", request.url));
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(PARTICIPANT_SESSION_COOKIE, signParticipantSession(personId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
