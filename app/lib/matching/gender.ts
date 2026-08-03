/**
 * Gender identity and partner-gender-preference are free text in the
 * signup form (see lib/db/schema.ts), not a fixed enum -- deliberately, so
 * we don't force people into categories that don't fit. That means
 * matching has to work with arbitrary strings, which this module
 * normalizes into a few broad canonical buckets on a best-effort basis.
 */

const NO_PREFERENCE_PHRASES = [
  "",
  "no preference",
  "no pref",
  "none",
  "any",
  "anyone",
  "n/a",
  "na",
  "doesn't matter",
  "does not matter",
  "no strong preference",
];

const CANONICAL_BUCKETS: Record<string, string[]> = {
  woman: ["woman", "women", "female", "cis woman", "cisgender woman", "trans woman", "girl"],
  man: ["man", "men", "male", "cis man", "cisgender man", "trans man", "guy"],
  nonbinary: [
    "non-binary",
    "nonbinary",
    "non binary",
    "nb",
    "enby",
    "genderqueer",
    "gender queer",
    "genderfluid",
    "gender fluid",
    "agender",
  ],
};

// Hyphens are stripped (not just whitespace-collapsed) so "non-binary" and
// "nonbinary" -- both listed as synonyms below -- compare equal. Without
// this, "non-binary" (a stated preference) and free text like "nonbinary
// they/them" (an identity) never matched: the exact-bucket check requires
// the whole string to equal a synonym, and the substring fallback is
// literal, so the hyphen alone was enough to miss an otherwise-clear match.
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/-/g, "").replace(/\s+/g, " ");
}

/**
 * Phrases that invert the meaning of whatever follows them. These matter
 * because the substring fallback below is otherwise exactly backwards for
 * a negated preference: "not a man" *contains* "man", so a naive
 * containment check reads it as satisfied by a man -- the single worst
 * way this function can be wrong, since it silently overrides a stated
 * hard requirement.
 */
// Deliberately excludes bare "non" -- it's essentially never used alone as
// a negation word in English (unlike "not"/"no"/"none"), and including it
// meant "non-binary" and "non binary" -- both listed as identity synonyms
// just above -- were misread as negations whenever the other side's free
// text didn't happen to match a bucket synonym exactly, silently blocking
// valid matches for non-binary participants with a hard requirement.
const NEGATION_PATTERN =
  /\b(not|no|none|never|anyone but|anything but|any but|except|other than|besides|excluding|rather not|prefer not|avoid)\b/;

function isNegated(text: string): boolean {
  return NEGATION_PATTERN.test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `text` names a bucket, by any of its synonyms, as a whole word.
 * Whole-word matters: "man" is a substring of "woman", so a plain
 * `includes` would read "no women" as naming the man bucket. */
function mentionsBucket(text: string, bucket: string): boolean {
  return CANONICAL_BUCKETS[bucket].some((synonym) =>
    new RegExp(`\\b${escapeRegExp(synonym)}\\b`).test(text),
  );
}

function toBucket(text: string): string | null {
  const normalized = normalize(text);
  for (const [bucket, synonyms] of Object.entries(CANONICAL_BUCKETS)) {
    if (synonyms.includes(normalized)) return bucket;
  }
  return null;
}

export function isNoPreference(preferenceText: string | null | undefined): boolean {
  if (!preferenceText) return true;
  return NO_PREFERENCE_PHRASES.includes(normalize(preferenceText));
}

export type GenderMatchResult = "satisfied" | "mismatch" | "unknown";

/**
 * Checks whether `candidateIdentity` satisfies `preference`.
 *
 * - Empty/"no preference"-style text always satisfies.
 * - If both sides normalize into a recognized bucket (woman/man/nonbinary),
 *   compares those buckets directly.
 * - Otherwise falls back to substring containment as a heuristic for
 *   free-text answers we don't recognize -- except when the preference is
 *   phrased as a negation ("not a man"), where containment means the
 *   opposite and can never confirm a match.
 * - If we genuinely can't tell, returns "unknown" -- callers enforcing a
 *   *hard* requirement should treat "unknown" as not satisfied (a false
 *   block is a minor annoyance; silently ignoring someone's stated
 *   requirement is not), while soft scoring should treat it as neutral.
 */
export function checkGenderPreference(
  preference: string | null | undefined,
  candidateIdentity: string | null | undefined,
): GenderMatchResult {
  if (isNoPreference(preference)) return "satisfied";

  const preferenceBucket = toBucket(preference!);
  const identityBucket = candidateIdentity ? toBucket(candidateIdentity) : null;

  if (preferenceBucket && identityBucket) {
    return preferenceBucket === identityBucket ? "satisfied" : "mismatch";
  }

  if (!candidateIdentity) return "unknown";

  const normPref = normalize(preference!);
  const normIdentity = normalize(candidateIdentity);

  // A negated preference ("not a man", "anyone but women") can never be
  // confirmed satisfied by the substring heuristic -- containment means
  // the opposite there. Fall through to "mismatch"/"unknown" instead,
  // which is the safe direction: a false block is a minor annoyance,
  // quietly ignoring someone's stated requirement is not.
  const negated = isNegated(normPref);

  if (
    !negated &&
    (normPref === normIdentity ||
      normIdentity.includes(normPref) ||
      normPref.includes(normIdentity))
  ) {
    return "satisfied";
  }

  if (negated) {
    // If the thing they said no to is what this person is, that's a real
    // mismatch; otherwise we genuinely can't tell from free text.
    // Whole-word again, for the same reason as mentionsBucket: a plain
    // `includes` would read "not a woman" as excluding a "man".
    const namesIdentityVerbatim = new RegExp(`\\b${escapeRegExp(normIdentity)}\\b`).test(normPref);
    const excludesThisPerson =
      namesIdentityVerbatim ||
      (identityBucket !== null && mentionsBucket(normPref, identityBucket));
    return excludesThisPerson ? "mismatch" : "unknown";
  }

  if (preferenceBucket || identityBucket) {
    // One side parsed into a known bucket and the other didn't match it or
    // fall back to a substring hit -- that's a real signal, not ambiguity.
    return "mismatch";
  }

  return "unknown";
}
