import { describe, expect, it } from "vitest";
import { allOccurrences, computeWeekCount, firstOccurrenceUTC } from "../instants";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("firstOccurrenceUTC", () => {
  it("lands on the requested weekday and time of day", () => {
    for (let canonicalDay = 0; canonicalDay < 7; canonicalDay++) {
      const result = firstOccurrenceUTC("2026-10-05", canonicalDay, 375); // 6:15am
      expect(result.getUTCDay()).toBe(canonicalDay);
      expect(result.getUTCHours() * 60 + result.getUTCMinutes()).toBe(375);
    }
  });

  it("never falls before the cohort start date, and always within 6 days after it", () => {
    const reference = new Date("2026-10-05T00:00:00Z").getTime();
    for (let canonicalDay = 0; canonicalDay < 7; canonicalDay++) {
      const result = firstOccurrenceUTC("2026-10-05", canonicalDay, 0).getTime();
      expect(result).toBeGreaterThanOrEqual(reference);
      expect(result).toBeLessThan(reference + 7 * DAY_MS);
    }
  });

  it("returns the start date itself when the weekday matches", () => {
    // 2026-10-05 is a Monday (getUTCDay() === 1).
    const result = firstOccurrenceUTC("2026-10-05", 1, 360);
    expect(result.toISOString()).toBe("2026-10-05T06:00:00.000Z");
  });
});

describe("computeWeekCount", () => {
  it("computes whole weeks between start and end dates", () => {
    expect(computeWeekCount("2026-10-05", "2026-11-02")).toBe(4);
  });

  it("defaults to 4 when either date is missing", () => {
    expect(computeWeekCount(null, "2026-11-02")).toBe(4);
    expect(computeWeekCount("2026-10-05", undefined)).toBe(4);
  });

  it("rounds to the nearest whole week for non-exact spans", () => {
    expect(computeWeekCount("2026-10-05", "2026-11-05")).toBe(4); // 31 days ~ 4.43 weeks
  });

  it("falls back to the 4-week default for a non-positive span (same/reversed dates)", () => {
    expect(computeWeekCount("2026-10-05", "2026-10-05")).toBe(4);
    expect(computeWeekCount("2026-10-05", "2026-10-01")).toBe(4); // end before start
  });

  it("clamps a short-but-positive span up to at least 1 week", () => {
    expect(computeWeekCount("2026-10-05", "2026-10-08")).toBe(1); // 3 days -> rounds to 0 without the floor
  });
});

describe("allOccurrences", () => {
  it("returns weekCount instants spaced exactly 7 days apart, starting with the first", () => {
    const first = new Date("2026-10-05T06:00:00.000Z");
    const result = allOccurrences(first, 4);
    expect(result).toHaveLength(4);
    expect(result[0].toISOString()).toBe("2026-10-05T06:00:00.000Z");
    expect(result[1].toISOString()).toBe("2026-10-12T06:00:00.000Z");
    expect(result[2].toISOString()).toBe("2026-10-19T06:00:00.000Z");
    expect(result[3].toISOString()).toBe("2026-10-26T06:00:00.000Z");
  });

  it("returns a single occurrence for weekCount of 1", () => {
    const first = new Date("2026-10-05T06:00:00.000Z");
    expect(allOccurrences(first, 1)).toEqual([first]);
  });
});
