import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySession } from "@/lib/auth";
import { PARTICIPANT_SESSION_COOKIE, verifyParticipantSession } from "@/lib/participant-auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const authed = verifySession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!authed) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Participant-facing routes (dashboard, feedback).
  const personId = verifyParticipantSession(
    request.cookies.get(PARTICIPANT_SESSION_COOKIE)?.value,
  );
  if (!personId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/feedback/:path*"],
};
