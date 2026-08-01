/** Plain functions building email content -- kept separate from the
 * sending logic (lib/email/resend.ts) so the content itself is easy to
 * read and change without touching any network code. */

/**
 * Escapes a value before it's interpolated into an email's HTML body.
 * Several of these values are attacker-controllable free text from the
 * signup form (first names, most obviously) and land in *someone else's*
 * inbox -- a partner named `<a href="http://evil">click</a>` should show
 * up as that literal text, not as a link in their session reminder.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Your PausePal sign-in link",
    text: `Sign in to PausePal: ${url}\n\nThis link expires in 30 minutes and can only be used once.`,
    html: `
      <p>Sign in to PausePal by clicking the link below.</p>
      <p><a href="${esc(url)}">${esc(url)}</a></p>
      <p>This link expires in 30 minutes and can only be used once.</p>
    `.trim(),
  };
}

export function sessionReminderEmail(input: {
  firstName: string;
  partnerFirstNames: string[];
  whenLocal: string;
  zoomJoinUrl: string | null;
}): { subject: string; html: string; text: string } {
  const partners = input.partnerFirstNames.join(" & ");
  const joinLine = input.zoomJoinUrl
    ? `Join here: ${input.zoomJoinUrl}`
    : "Your Zoom link will be shared separately.";
  return {
    subject: `Meditation with ${partners} tomorrow`,
    text: `Hi ${input.firstName},\n\nJust a reminder: you're meditating with ${partners} tomorrow at ${input.whenLocal}.\n\n${joinLine}`,
    html: `
      <p>Hi ${esc(input.firstName)},</p>
      <p>Just a reminder: you're meditating with <strong>${esc(partners)}</strong> tomorrow at <strong>${esc(input.whenLocal)}</strong>.</p>
      <p>${input.zoomJoinUrl ? `<a href="${esc(input.zoomJoinUrl)}">Join on Zoom</a>` : esc(joinLine)}</p>
    `.trim(),
  };
}

export function cohortStartsTomorrowEmail(input: {
  firstName: string;
  cohortNumber: number;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Your PausePal cohort starts tomorrow",
    text: `Hi ${input.firstName},\n\nCohort ${input.cohortNumber} starts tomorrow! Check your dashboard for your match and session times.`,
    html: `
      <p>Hi ${esc(input.firstName)},</p>
      <p>Cohort ${input.cohortNumber} starts tomorrow! Check your dashboard for your match and session times.</p>
    `.trim(),
  };
}

export function feedbackAskEmail(input: {
  firstName: string;
  feedbackUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "How was your PausePal experience?",
    text: `Hi ${input.firstName},\n\nYour PausePal cohort has wrapped up -- we'd love to hear how it went: ${input.feedbackUrl}`,
    html: `
      <p>Hi ${esc(input.firstName)},</p>
      <p>Your PausePal cohort has wrapped up -- we'd love to hear how it went.</p>
      <p><a href="${esc(input.feedbackUrl)}">Share your feedback</a></p>
    `.trim(),
  };
}
