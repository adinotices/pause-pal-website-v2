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

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
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
 *   free-text answers we don't recognize.
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
  if (normPref === normIdentity || normIdentity.includes(normPref) || normPref.includes(normIdentity)) {
    return "satisfied";
  }

  if (preferenceBucket || identityBucket) {
    // One side parsed into a known bucket and the other didn't match it or
    // fall back to a substring hit -- that's a real signal, not ambiguity.
    return "mismatch";
  }

  return "unknown";
}
