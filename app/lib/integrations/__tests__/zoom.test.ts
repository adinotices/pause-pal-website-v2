import { describe, expect, it } from "vitest";
import { buildCreateMeetingPayload } from "../zoom";

describe("buildCreateMeetingPayload", () => {
  it("requests a recurring, no-fixed-time meeting with the given topic", () => {
    const payload = buildCreateMeetingPayload("PausePal: Alice & Bob");
    expect(payload.topic).toBe("PausePal: Alice & Bob");
    expect(payload.type).toBe(3); // recurring, no fixed time
  });

  it("allows joining before the host and skips registration/waiting room friction", () => {
    const payload = buildCreateMeetingPayload("x");
    expect(payload.settings.join_before_host).toBe(true);
    expect(payload.settings.waiting_room).toBe(false);
    expect(payload.settings.approval_type).toBe(2); // no registration required
  });
});
