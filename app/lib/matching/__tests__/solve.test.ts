import { describe, expect, it } from "vitest";
import { generateMatches } from "../solve";
import { pairKey } from "../compatibility";
import { GENEROUS_SLOTS, testCandidate } from "./testCandidates";

const NO_HISTORY = new Set<string>();

function allSignupIds(result: ReturnType<typeof generateMatches>): number[] {
  return [...result.groups.flatMap((g) => g.signupIds), ...result.unmatchedSignupIds];
}

describe("generateMatches", () => {
  it("pairs everyone up when the candidate count is even and all mutually feasible", () => {
    const candidates = ["A", "B", "C", "D"].map((name) =>
      testCandidate({ firstName: name, localSlots: GENEROUS_SLOTS }),
    );
    const result = generateMatches(candidates, NO_HISTORY);

    expect(result.unmatchedSignupIds).toEqual([]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.every((g) => g.signupIds.length === 2)).toBe(true);

    const ids = allSignupIds(result);
    expect(new Set(ids).size).toBe(candidates.length);
  });

  it("folds a leftover odd person into a trio when a feasible one exists", () => {
    const candidates = ["A", "B", "C"].map((name) =>
      testCandidate({ firstName: name, localSlots: GENEROUS_SLOTS }),
    );
    const result = generateMatches(candidates, NO_HISTORY);

    expect(result.unmatchedSignupIds).toEqual([]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].signupIds).toHaveLength(3);
  });

  it("leaves someone unmatched rather than forcing an infeasible trio", () => {
    const a = testCandidate({ firstName: "Ada", localSlots: GENEROUS_SLOTS });
    const b = testCandidate({ firstName: "Bo", localSlots: GENEROUS_SLOTS });
    const isolated = testCandidate({
      firstName: "Isolated",
      localSlots: [{ dayOfWeek: 0, startMinute: 60, endMinute: 120 }], // Sunday only, never overlaps GENEROUS_SLOTS
    });

    const result = generateMatches([a, b, isolated], NO_HISTORY);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].signupIds.sort()).toEqual([a.signupId, b.signupId].sort());
    expect(result.unmatchedSignupIds).toEqual([isolated.signupId]);
  });

  it("never places the same signup in two groups, and accounts for everyone", () => {
    const candidates = ["A", "B", "C", "D", "E", "F", "G"].map((name) =>
      testCandidate({ firstName: name, localSlots: GENEROUS_SLOTS }),
    );
    const result = generateMatches(candidates, NO_HISTORY);

    const ids = allSignupIds(result);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids.length).toBe(candidates.length); // everyone accounted for
  });

  it("avoids re-pairing two people who were matched in a previous cohort when a comparably good alternative exists", () => {
    const a = testCandidate({
      firstName: "Ada",
      localSlots: GENEROUS_SLOTS,
      sessionLength: "15",
      sessionsPerWeek: 3,
      signupId: 101,
    });
    const b = testCandidate({
      firstName: "Bo",
      localSlots: GENEROUS_SLOTS,
      sessionLength: "15",
      sessionsPerWeek: 3,
      signupId: 102,
    });
    const c = testCandidate({
      firstName: "Cy",
      localSlots: GENEROUS_SLOTS,
      sessionLength: "10",
      sessionsPerWeek: 2,
      signupId: 103,
    });
    const d = testCandidate({
      firstName: "Dee",
      localSlots: GENEROUS_SLOTS,
      sessionLength: "10",
      sessionsPerWeek: 2,
      signupId: 104,
    });

    const withoutHistory = generateMatches([a, b, c, d], NO_HISTORY);
    const abTogetherWithoutHistory = withoutHistory.groups.some(
      (g) => g.signupIds.includes(101) && g.signupIds.includes(102),
    );
    expect(abTogetherWithoutHistory).toBe(true); // sanity check: AB is the strictly best pairing absent history

    const history = new Set([pairKey(101, 102)]);
    const withHistory = generateMatches([a, b, c, d], history);
    const abTogetherWithHistory = withHistory.groups.some(
      (g) => g.signupIds.includes(101) && g.signupIds.includes(102),
    );
    expect(abTogetherWithHistory).toBe(false);
  });

  it("returns everyone as unmatched when there are fewer than 2 candidates", () => {
    const a = testCandidate({ firstName: "Solo", localSlots: GENEROUS_SLOTS });
    expect(generateMatches([a], NO_HISTORY)).toEqual({
      groups: [],
      unmatchedSignupIds: [a.signupId],
    });
  });
});
