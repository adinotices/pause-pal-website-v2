import { describe, expect, it } from "vitest";
import { evaluateGroup, pairKey } from "../compatibility";
import { GENEROUS_SLOTS, testCandidate } from "./testCandidates";

const NO_HISTORY = new Set<string>();

describe("evaluateGroup - feasibility", () => {
  it("is feasible when two people share enough overlapping time", () => {
    const a = testCandidate({ firstName: "Ada", localSlots: GENEROUS_SLOTS });
    const b = testCandidate({ firstName: "Bo", localSlots: GENEROUS_SLOTS });
    const result = evaluateGroup([a, b], NO_HISTORY);
    expect(result.feasible).toBe(true);
    expect(result.sessionsAvailable).toBeGreaterThan(0);
  });

  it("is infeasible with zero overlapping availability", () => {
    const a = testCandidate({
      firstName: "Ada",
      localSlots: [{ dayOfWeek: 1, startMinute: 360, endMinute: 420 }],
    });
    const b = testCandidate({
      firstName: "Bo",
      localSlots: [{ dayOfWeek: 2, startMinute: 360, endMinute: 420 }],
    });
    const result = evaluateGroup([a, b], NO_HISTORY);
    expect(result.feasible).toBe(false);
    expect(result.blockedReason).toBeTruthy();
  });

  it("blocks a match that violates a stated hard gender requirement", () => {
    const a = testCandidate({
      firstName: "Ada",
      localSlots: GENEROUS_SLOTS,
      partnerGenderPreference: "woman",
      partnerGenderIsHardRequirement: true,
    });
    const b = testCandidate({
      firstName: "Bo",
      localSlots: GENEROUS_SLOTS,
      ownGenderIdentity: "man",
    });
    const result = evaluateGroup([a, b], NO_HISTORY);
    expect(result.feasible).toBe(false);
  });

  it("allows a match that satisfies a stated hard gender requirement", () => {
    const a = testCandidate({
      firstName: "Ada",
      localSlots: GENEROUS_SLOTS,
      partnerGenderPreference: "woman",
      partnerGenderIsHardRequirement: true,
    });
    const b = testCandidate({
      firstName: "Bo",
      localSlots: GENEROUS_SLOTS,
      ownGenderIdentity: "woman",
    });
    const result = evaluateGroup([a, b], NO_HISTORY);
    expect(result.feasible).toBe(true);
  });

  it("blocks a hard requirement when the other person's identity is unknown", () => {
    // Unknown must fail a *hard* requirement -- silently ignoring someone's
    // stated requirement is worse than an occasional false block.
    const a = testCandidate({
      firstName: "Ada",
      localSlots: GENEROUS_SLOTS,
      partnerGenderPreference: "woman",
      partnerGenderIsHardRequirement: true,
    });
    const b = testCandidate({ firstName: "Bo", localSlots: GENEROUS_SLOTS, ownGenderIdentity: null });
    expect(evaluateGroup([a, b], NO_HISTORY).feasible).toBe(false);
  });
});

describe("evaluateGroup - scoring", () => {
  it("scores a repeat pairing lower than an otherwise-identical fresh one", () => {
    const a = testCandidate({ firstName: "Ada", localSlots: GENEROUS_SLOTS, signupId: 1 });
    const b = testCandidate({ firstName: "Bo", localSlots: GENEROUS_SLOTS, signupId: 2 });

    const fresh = evaluateGroup([a, b], new Set());
    const repeat = evaluateGroup([a, b], new Set([pairKey(1, 2)]));

    expect(repeat.score).toBeLessThan(fresh.score);
  });

  it("scores closer session-length/frequency preferences higher", () => {
    const a = testCandidate({ firstName: "Ada", localSlots: GENEROUS_SLOTS, sessionLength: "15", sessionsPerWeek: 3 });
    const closeMatch = testCandidate({
      firstName: "Bo",
      localSlots: GENEROUS_SLOTS,
      sessionLength: "15",
      sessionsPerWeek: 3,
    });
    const farMatch = testCandidate({
      firstName: "Cy",
      localSlots: GENEROUS_SLOTS,
      sessionLength: "30_plus",
      sessionsPerWeek: 7,
    });

    const close = evaluateGroup([a, closeMatch], NO_HISTORY);
    const far = evaluateGroup([a, farMatch], NO_HISTORY);

    expect(close.score).toBeGreaterThan(far.score);
  });
});

describe("evaluateGroup - trios", () => {
  it("requires all three members to mutually overlap, not just pairwise", () => {
    // A & B overlap Mon 6-7am; B & C overlap Wed 6-7am; A & C never overlap.
    const a = testCandidate({
      firstName: "Ada",
      localSlots: [{ dayOfWeek: 1, startMinute: 360, endMinute: 420 }],
    });
    const b = testCandidate({
      firstName: "Bo",
      localSlots: [
        { dayOfWeek: 1, startMinute: 360, endMinute: 420 },
        { dayOfWeek: 3, startMinute: 360, endMinute: 420 },
      ],
    });
    const c = testCandidate({
      firstName: "Cy",
      localSlots: [{ dayOfWeek: 3, startMinute: 360, endMinute: 420 }],
    });

    expect(evaluateGroup([a, b], NO_HISTORY).feasible).toBe(true);
    expect(evaluateGroup([b, c], NO_HISTORY).feasible).toBe(true);
    expect(evaluateGroup([a, c], NO_HISTORY).feasible).toBe(false);
    expect(evaluateGroup([a, b, c], NO_HISTORY).feasible).toBe(false);
  });

  it("is feasible for a trio with true three-way overlap", () => {
    const a = testCandidate({ firstName: "Ada", localSlots: GENEROUS_SLOTS });
    const b = testCandidate({ firstName: "Bo", localSlots: GENEROUS_SLOTS });
    const c = testCandidate({ firstName: "Cy", localSlots: GENEROUS_SLOTS });
    expect(evaluateGroup([a, b, c], NO_HISTORY).feasible).toBe(true);
  });
});
