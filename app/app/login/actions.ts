"use server";

import { createMagicLinkToken, findPersonByEmail } from "@/lib/db/auth-queries";
import { magicLinkEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { getAppUrl } from "@/lib/site-url";

export type LoginState = { status: "idle" | "sent" };

/** Always returns the same "sent" response regardless of whether the
 * email matched a known person -- otherwise this endpoint could be used
 * to check which emails have signed up before. */
export async function requestMagicLinkAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();

  if (email) {
    const person = await findPersonByEmail(email);
    if (person) {
      const token = await createMagicLinkToken(person.id);
      const url = `${getAppUrl()}/auth/verify?token=${token}`;
      const { subject, html, text } = magicLinkEmail(url);
      await sendEmail({ to: person.email, subject, html, text });
    }
  }

  return { status: "sent" };
}
