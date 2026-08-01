import { describe, expect, it } from "vitest";
import { computeMatchSchedule } from "../compute-schedule";
import type { RawSignupInput } from "@/lib/matching/candidate";

const GENEROUS_SLOTS = [1, 3, 5].flatMap((day) => [
  { dayOfWeek: day, startMinute: 360, endMinute: 420 },
  { dayOfWeek: day, startMinute: 1080, endMinute: 1140 },
]);

function member(overrides: Partial<RawSignupInput> & { signupId: number }): RawSignupInput {
  return {
    signupId: overrides.signupId,
    personId: overrides.signupId,
    firstName: overrides.firstName ?? `Person${overrides.signupId}`,
    timezone: overrides.timezone ?? "UTC",
    sessionsPerWeek: overrides.sessionsPerWeek ?? 3,
    sessionLength: overrides.sessionLength ?? "15",
    ownGenderIdentity: null,
    partnerGenderPreference: null,
    partnerGenderIsHardRequirement: false,
    experienceLevel: overrides.experienceLevel ?? "new",
    localSlots: overrides.localSlots ?? GENEROUS_SLOTS,
  };
}

describe("computeMatchSchedule", () => {
  it("returns one session per week desired, at real UTC instants on/after the cohort start", () => {
    const members = [member({ signupId: 1 }), member({ signupId: 2 })];
    const sessions = computeMatchSchedule(members, "2026-10-05");

    expect(sessions).toHaveLength(3); // both want 3x/week
    for (const s of sessions) {
      expect(s.firstOccurrenceAt.getTime()).toBeGreaterThanOrEqual(
        new Date("2026-10-05T00:00:00Z").getTime(),
      );
      expect(s.firstOccurrenceAt.getUTCDay()).toBe(s.dayOfWeek);
    }
  });

  it("matches to the lower of the two members' weekly frequency preferences", () => {
    const members = [
      member({ signupId: 1, sessionsPerWeek: 5 }),
      member({ signupId: 2, sessionsPerWeek: 2 }),
    ];
    const sessions = computeMatchSchedule(members, "2026-10-05");
    expect(sessions).toHaveLength(2);
  });

  it("returns nothing for a group smaller than 2", () => {
    expect(computeMatchSchedule([member({ signupId: 1 })], "2026-10-05")).toEqual([]);
  });

  it("respects real timezone differences, not just raw local-clock numbers", () => {
    const members = [
      member({ signupId: 1, timezone: "America/New_York" }),
      member({ signupId: 2, timezone: "America/New_York" }),
    ];
    const sessions = computeMatchSchedule(members, "2026-10-05");
    // Same timezone, identical local slots -> full overlap, all 3 sessions found.
    expect(sessions).toHaveLength(3);
  });
});
