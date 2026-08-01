import { describe, expect, it } from "vitest";
import { utcOffsetMinutes } from "../tz";

describe("utcOffsetMinutes", () => {
  it("returns 0 for UTC", () => {
    expect(utcOffsetMinutes("UTC", "2026-06-15")).toBe(0);
  });

  it("resolves a fixed non-DST offset (Asia/Kolkata, UTC+5:30)", () => {
    expect(utcOffsetMinutes("Asia/Kolkata", "2026-01-15")).toBe(330);
    expect(utcOffsetMinutes("Asia/Kolkata", "2026-07-15")).toBe(330);
  });

  it("resolves winter vs summer offsets for a DST zone (America/New_York)", () => {
    expect(utcOffsetMinutes("America/New_York", "2026-01-15")).toBe(-300); // EST, UTC-5
    expect(utcOffsetMinutes("America/New_York", "2026-07-15")).toBe(-240); // EDT, UTC-4
  });

  it("resolves southern-hemisphere DST on the opposite schedule (Pacific/Auckland)", () => {
    expect(utcOffsetMinutes("Pacific/Auckland", "2026-01-15")).toBe(780); // NZDT, UTC+13
    expect(utcOffsetMinutes("Pacific/Auckland", "2026-07-15")).toBe(720); // NZST, UTC+12
  });

  it("gives different offsets for the same zone across a DST transition", () => {
    const before = utcOffsetMinutes("America/New_York", "2026-03-01");
    const after = utcOffsetMinutes("America/New_York", "2026-03-15");
    expect(before).not.toBe(after);
  });
});
