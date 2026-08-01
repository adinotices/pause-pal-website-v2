import { afterEach, describe, expect, it, vi } from "vitest";
import { signParticipantSession, verifyParticipantSession } from "../participant-auth";

vi.stubEnv("PARTICIPANT_SESSION_SECRET", "test-secret-value");

afterEach(() => {
  vi.stubEnv("PARTICIPANT_SESSION_SECRET", "test-secret-value");
});

describe("participant session cookie", () => {
  it("round-trips a valid session", () => {
    const cookie = signParticipantSession(42);
    expect(verifyParticipantSession(cookie)).toBe(42);
  });

  it("rejects a missing cookie", () => {
    expect(verifyParticipantSession(undefined)).toBeNull();
  });

  it("rejects a tampered personId with the original signature", () => {
    const cookie = signParticipantSession(42);
    const [, signature] = cookie.split(".");
    const tampered = `43.${signature}`;
    expect(verifyParticipantSession(tampered)).toBeNull();
  });

  it("rejects a garbage signature", () => {
    expect(verifyParticipantSession("42.not-a-real-signature")).toBeNull();
  });

  it("rejects a malformed cookie", () => {
    expect(verifyParticipantSession("garbage")).toBeNull();
    expect(verifyParticipantSession("")).toBeNull();
  });

  it("rejects a cookie signed with a different secret", () => {
    const cookie = signParticipantSession(42);
    vi.stubEnv("PARTICIPANT_SESSION_SECRET", "a-different-secret");
    expect(verifyParticipantSession(cookie)).toBeNull();
  });
});
