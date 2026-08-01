import { redirect } from "next/navigation";
import { getCurrentPersonId } from "@/lib/current-participant";
import { getFeedbackTargetForPerson } from "@/lib/db/feedback-queries";
import FeedbackForm from "./FeedbackForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feedback — PausePal" };

export default async function FeedbackPage() {
  const personId = await getCurrentPersonId();
  if (!personId) redirect("/login");

  const target = await getFeedbackTargetForPerson(personId);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Share your feedback</h1>

      {!target ? (
        <p className="mt-4 text-neutral-600">
          We couldn&apos;t find a completed match on your account yet -- feedback is available
          once you&apos;ve been matched with a partner.
        </p>
      ) : (
        <div className="mt-6">
          <FeedbackForm
            initialRating={target.feedback?.rating ?? 5}
            initialText={target.feedback?.text ?? ""}
            initialConsent={target.feedback?.consentToPublish ?? false}
          />
        </div>
      )}
    </main>
  );
}
