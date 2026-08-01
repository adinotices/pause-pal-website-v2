import { NextResponse } from "next/server";
import { listPublishedTestimonials } from "@/lib/db/feedback-queries";

/** Public, read-only, no-auth API for the static marketing site
 * (pausepal.co) to fetch admin-curated testimonials -- open CORS since
 * this is non-sensitive content meant to be embedded cross-origin. */
export async function GET() {
  const testimonials = await listPublishedTestimonials();
  return NextResponse.json(
    { testimonials },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
