import { describe, expect, it } from "vitest";
import {
  MINUTES_PER_WEEK,
  intersectIntervals,
  summarizeOverlap,
  toCanonicalIntervals,
} from "../availability";

describe("toCanonicalIntervals", () => {
  it("passes local slots through unchanged at offset 0", () => {
    const result = toCanonicalIntervals(
      [{ dayOfWeek: 1, startMinute: 360, endMinute: 420 }],
      0,
    );
    expect(result).toEqual([{ start: 1 * 1440 + 360, end: 1 * 1440 + 420 }]);
  });

  it("shifts backward into the previous day for a large positive offset", () => {
    // Monday 6:00-7:00am local, in a UTC+13 zone (e.g. NZ) -> Sunday 5-6pm shared-timeline.
    const result = toCanonicalIntervals(
      [{ dayOfWeek: 1, startMinute: 360, endMinute: 420 }],
      780,
    );
    expect(result).toEqual([{ start: 1020, end: 1080 }]); // Sunday 17:00-18:00
  });

  it("wraps around the end of the week when a shift pushes past Saturday midnight", () => {
    // Saturday 23:50-24:00 local, offset -5 pushes it 5 minutes later in the
    // shared timeline, past the week boundary -> splits into two pieces.
    const result = toCanonicalIntervals(
      [{ dayOfWeek: 6, startMinute: 1430, endMinute: 1440 }],
      -5,
    );
    expect(result).toEqual([
      { start: 0, end: 5 },
      { start: 10075, end: 10080 },
    ]);
    expect(MINUTES_PER_WEEK).toBe(10080);
  });

  it("merges overlapping/adjacent intervals", () => {
    const result = toCanonicalIntervals(
      [
        { dayOfWeek: 2, startMinute: 480, endMinute: 540 },
        { dayOfWeek: 2, startMinute: 540, endMinute: 600 }, // adjacent, should merge
      ],
      0,
    );
    expect(result).toEqual([{ start: 2 * 1440 + 480, end: 2 * 1440 + 600 }]);
  });

  it("drops zero/negative-length slots", () => {
    expect(toCanonicalIntervals([{ dayOfWeek: 0, startMinute: 100, endMinute: 100 }], 0)).toEqual(
      [],
    );
  });
});

describe("intersectIntervals", () => {
  it("finds the overlapping portion of two interval sets", () => {
    const a = [{ start: 100, end: 200 }];
    const b = [{ start: 150, end: 250 }];
    expect(intersectIntervals(a, b)).toEqual([{ start: 150, end: 200 }]);
  });

  it("returns nothing for non-overlapping intervals", () => {
    const a = [{ start: 0, end: 50 }];
    const b = [{ start: 100, end: 150 }];
    expect(intersectIntervals(a, b)).toEqual([]);
  });

  it("handles multiple disjoint overlaps", () => {
    const a = [
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ];
    const b = [
      { start: 50, end: 150 },
      { start: 250, end: 350 },
    ];
    expect(intersectIntervals(a, b)).toEqual([
      { start: 50, end: 100 },
      { start: 250, end: 300 },
    ]);
  });
});

describe("summarizeOverlap", () => {
  it("counts how many sessions of a given length fit in the overlap", () => {
    const a = [{ start: 0, end: 100 }]; // 100 minutes
    const b = [{ start: 0, end: 100 }];
    const summary = summarizeOverlap([a, b], 30);
    expect(summary.totalOverlapMinutes).toBe(100);
    expect(summary.sessionsAvailable).toBe(3); // floor(100/30)
  });

  it("returns zero sessions when the overlap is shorter than one session", () => {
    const a = [{ start: 0, end: 10 }];
    const b = [{ start: 0, end: 10 }];
    const summary = summarizeOverlap([a, b], 30);
    expect(summary.sessionsAvailable).toBe(0);
  });

  it("reduces three-way overlap the same way evaluateGroup does for a trio", () => {
    const a = [{ start: 0, end: 100 }];
    const b = [{ start: 50, end: 150 }];
    const c = [{ start: 80, end: 200 }];
    const summary = summarizeOverlap([a, b, c], 10);
    expect(summary.windows).toEqual([{ start: 80, end: 100 }]);
    expect(summary.sessionsAvailable).toBe(2);
  });
});
