import { describe, expect, it } from "vitest";
import { pickSessionTimes } from "../pick-sessions";
import type { WeeklyInterval } from "@/lib/matching/availability";

describe("pickSessionTimes", () => {
  it("returns nothing when zero sessions are desired", () => {
    expect(pickSessionTimes([{ start: 0, end: 100 }], 15, 0)).toEqual([]);
  });

  it("spreads sessions across distinct days when enough are available", () => {
    // Three separate 60-minute windows on Monday(1500), Wednesday(4380), Friday(7260).
    const windows: WeeklyInterval[] = [
      { start: 1 * 1440 + 360, end: 1 * 1440 + 420 },
      { start: 3 * 1440 + 360, end: 3 * 1440 + 420 },
      { start: 5 * 1440 + 360, end: 5 * 1440 + 420 },
    ];
    const result = pickSessionTimes(windows, 15, 3);
    expect(result).toHaveLength(3);
    const days = new Set(result.map((s) => s.dayOfWeek));
    expect(days.size).toBe(3);
  });

  it("repeats a day only when there aren't enough distinct-day options", () => {
    // A single generous 60-minute window on one day, 4 x 15-minute chunks fit.
    const windows: WeeklyInterval[] = [{ start: 1 * 1440 + 360, end: 1 * 1440 + 420 }];
    const result = pickSessionTimes(windows, 15, 3);
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.dayOfWeek === 1)).toBe(true);
    // No two chosen slots overlap.
    const sorted = [...result].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startMinute).toBeGreaterThanOrEqual(sorted[i - 1].endMinute);
    }
  });

  it("caps out at however many session-length chunks actually exist", () => {
    const windows: WeeklyInterval[] = [{ start: 0, end: 20 }]; // only one 15-min chunk fits
    const result = pickSessionTimes(windows, 15, 5);
    expect(result).toHaveLength(1);
  });

  it("never returns a slot that crosses a day boundary, even if the source window does", () => {
    // Window spans Monday 23:50 into Tuesday 00:20 (1430-1460 in week-minutes).
    const windows: WeeklyInterval[] = [{ start: 1 * 1440 + 1430, end: 1 * 1440 + 1460 }];
    const result = pickSessionTimes(windows, 15, 5);
    for (const slot of result) {
      expect(slot.startMinute).toBeGreaterThanOrEqual(0);
      expect(slot.endMinute).toBeLessThanOrEqual(1440);
    }
  });

  it("is deterministic given the same input", () => {
    const windows: WeeklyInterval[] = [
      { start: 1 * 1440 + 360, end: 1 * 1440 + 450 },
      { start: 4 * 1440 + 600, end: 4 * 1440 + 660 },
    ];
    expect(pickSessionTimes(windows, 15, 3)).toEqual(pickSessionTimes(windows, 15, 3));
  });
});
