import { describe, expect, it } from "vitest";
import { spansUSDST, usDSTTransitions } from "../time";

describe("usDSTTransitions", () => {
  it("computes the correct 2nd-Sunday-of-March / 1st-Sunday-of-November dates", () => {
    // Verified against the actual historical US DST transition dates.
    expect(usDSTTransitions(2024)).toEqual({
      springForward: new Date(2024, 2, 10),
      fallBack: new Date(2024, 10, 3),
    });
    expect(usDSTTransitions(2025)).toEqual({
      springForward: new Date(2025, 2, 9),
      fallBack: new Date(2025, 10, 2),
    });
    expect(usDSTTransitions(2026)).toEqual({
      springForward: new Date(2026, 2, 8),
      fallBack: new Date(2026, 10, 1),
    });
  });

  // Regression: this used to be a hardcoded table covering only
  // 2024-2026, so it silently stopped warning about anything from 2027
  // onward. Prove it still works well past that.
  it("keeps working for years far outside any hardcoded range", () => {
    expect(usDSTTransitions(2030)).toEqual({
      springForward: new Date(2030, 2, 10),
      fallBack: new Date(2030, 10, 3),
    });
    expect(usDSTTransitions(2050)).toEqual({
      springForward: new Date(2050, 2, 13),
      fallBack: new Date(2050, 10, 6),
    });
  });
});

describe("spansUSDST", () => {
  it("returns false for an empty or missing date", () => {
    expect(spansUSDST("", "2026-04-01")).toBe(false);
    expect(spansUSDST("2026-02-01", "")).toBe(false);
  });

  it("returns false for a range that doesn't cross a transition", () => {
    expect(spansUSDST("2026-04-01", "2026-04-28")).toBe(false);
  });

  it("returns true for a range crossing the spring-forward transition", () => {
    expect(spansUSDST("2026-03-01", "2026-03-15")).toBe(true);
  });

  it("returns true for a range crossing the fall-back transition", () => {
    expect(spansUSDST("2026-10-25", "2026-11-08")).toBe(true);
  });

  // The original bug: a cohort dated in 2027+ would silently get no
  // warning at all, since the old table only went up to 2026.
  it("still detects a crossing for a cohort dated well into the future", () => {
    expect(spansUSDST("2030-03-01", "2030-03-15")).toBe(true);
    expect(spansUSDST("2030-04-01", "2030-04-28")).toBe(false);
  });
});
