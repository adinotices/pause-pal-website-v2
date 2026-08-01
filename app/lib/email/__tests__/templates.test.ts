import { describe, expect, it } from "vitest";
import {
  cohortStartsTomorrowEmail,
  feedbackAskEmail,
  magicLinkEmail,
  sessionReminderEmail,
} from "../templates";

// First names are free text from the signup form, and a session reminder
// puts *your partner's* name into *your* inbox -- so unescaped
// interpolation would let one participant inject markup into another
// participant's email.
describe("email templates escape user-controlled values", () => {
  it("escapes a partner's first name in the session reminder", () => {
    const { html, subject } = sessionReminderEmail({
      firstName: "Alice",
      partnerFirstNames: ['<a href="https://evil.example">Bob</a>'],
      whenLocal: "Mon, 6:00 AM",
      zoomJoinUrl: "https://zoom.us/j/123",
    });

    expect(html).not.toContain("<a href=\"https://evil.example\">");
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
    // The plain-text part is not markup, so it stays readable as-is.
    expect(subject).toContain("<a href=");
  });

  it("escapes the recipient's own name in every template", () => {
    const name = "<script>x</script>";
    for (const html of [
      sessionReminderEmail({
        firstName: name,
        partnerFirstNames: ["Bob"],
        whenLocal: "Mon, 6:00 AM",
        zoomJoinUrl: null,
      }).html,
      cohortStartsTomorrowEmail({ firstName: name, cohortNumber: 9 }).html,
      feedbackAskEmail({ firstName: name, feedbackUrl: "https://app.pausepal.co/feedback" }).html,
    ]) {
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    }
  });

  it("still renders a usable magic link", () => {
    const url = "https://app.pausepal.co/auth/verify?token=abc123";
    const { html, text } = magicLinkEmail(url);
    expect(text).toContain(url);
    expect(html).toContain(`href="https://app.pausepal.co/auth/verify?token=abc123"`);
  });
});
