import { describe, expect, it } from "vitest";
import { checkGenderPreference, isNoPreference } from "../gender";

describe("isNoPreference", () => {
  it.each([null, undefined, "", "no preference", "No Preference", "any", "N/A", "  none  "])(
    "treats %p as no preference",
    (text) => {
      expect(isNoPreference(text)).toBe(true);
    },
  );

  it("does not treat a real preference as 'no preference'", () => {
    expect(isNoPreference("woman")).toBe(false);
  });
});

describe("checkGenderPreference", () => {
  it("satisfies an empty/no-preference request regardless of identity", () => {
    expect(checkGenderPreference("", "man")).toBe("satisfied");
    expect(checkGenderPreference("no preference", null)).toBe("satisfied");
  });

  it("matches recognized synonyms within the same bucket", () => {
    expect(checkGenderPreference("woman", "female")).toBe("satisfied");
    expect(checkGenderPreference("Man", "cis man")).toBe("satisfied");
    expect(checkGenderPreference("non-binary", "enby")).toBe("satisfied");
  });

  it("flags a mismatch between recognized buckets", () => {
    expect(checkGenderPreference("woman", "man")).toBe("mismatch");
    expect(checkGenderPreference("man", "non-binary")).toBe("mismatch");
  });

  it("falls back to substring matching for unrecognized free text", () => {
    expect(checkGenderPreference("trans femme", "trans femme")).toBe("satisfied");
  });

  it("returns unknown when identity is missing and preference isn't 'no preference'", () => {
    expect(checkGenderPreference("woman", null)).toBe("unknown");
  });

  it("returns unknown for unrecognized, unrelated free text on both sides", () => {
    expect(checkGenderPreference("purple elephant", "sea otter")).toBe("unknown");
  });
});
