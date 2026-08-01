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

  // The substring fallback reads a negated preference exactly backwards
  // ("not a man" contains "man"), which would silently override a stated
  // hard requirement -- the worst possible failure for this function.
  it("never reads a negated preference as satisfied by what it excludes", () => {
    expect(checkGenderPreference("not a man", "man")).toBe("mismatch");
    expect(checkGenderPreference("anyone but a man", "cis man")).toBe("mismatch");
    expect(checkGenderPreference("no men please", "male")).toBe("mismatch");
    expect(checkGenderPreference("anything but women", "woman")).toBe("mismatch");
    expect(checkGenderPreference("prefer not to be paired with men", "man")).toBe("mismatch");
  });

  it("stays at 'unknown' (not 'satisfied') for a negation it can't resolve", () => {
    expect(checkGenderPreference("not a man", "woman")).toBe("unknown");
  });

  it("matches excluded terms as whole words, so 'not a woman' doesn't exclude a man", () => {
    // "woman" contains "man" -- a plain substring check would read this as
    // a mismatch and block a pairing that's actually fine.
    expect(checkGenderPreference("not a woman", "man")).toBe("unknown");
    expect(checkGenderPreference("no women", "male")).toBe("unknown");
  });

  it("still treats 'no preference'-style phrasing as satisfied, not as a negation", () => {
    expect(checkGenderPreference("no preference", "man")).toBe("satisfied");
    expect(checkGenderPreference("none", "woman")).toBe("satisfied");
  });
});
