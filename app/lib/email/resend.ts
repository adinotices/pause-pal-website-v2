import { isEmailConfigured } from "@/lib/integrations/config";

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Sends transactional email via Resend. Without RESEND_API_KEY set, this
 * logs the email to the console instead of throwing -- magic links and
 * reminders need to be testable in dev without a real email provider, and
 * a missing key shouldn't take down the signup/login flow.
 */
export async function sendEmail(input: EmailInput): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(
      `[email:not-configured] Would send to ${input.to}: "${input.subject}"\n${input.text}`,
    );
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "PausePal <hello@pausepal.co>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
