const DAY_MS = 24 * 60 * 60 * 1000;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Converts a canonical weekly slot (see lib/matching/availability.ts --
 * this is the shared UTC-equivalent timeline the matching engine already
 * works in, so no further timezone math is needed here) into the real UTC
 * instant of its *first* occurrence, anchored to the cohort's start date.
 *
 * The result always falls on or within 6 days after `cohortStartsOnISO`
 * (never before) -- it's the first time that weekday/time occurs on or
 * after the cohort's actual start date.
 */
export function firstOccurrenceUTC(
  cohortStartsOnISO: string,
  canonicalDayOfWeek: number,
  canonicalStartMinute: number,
): Date {
  const referenceDate = new Date(`${cohortStartsOnISO}T00:00:00Z`);
  const referenceWeekday = referenceDate.getUTCDay();
  const dayDelta = mod(canonicalDayOfWeek - referenceWeekday, 7);
  return new Date(referenceDate.getTime() + dayDelta * DAY_MS + canonicalStartMinute * 60000);
}

/** How many weekly occurrences a cohort's program spans, from its start
 * and end dates. Defaults to 4 (the program's usual length) if either date
 * is missing or the math comes out non-positive. */
export function computeWeekCount(
  startsOnISO: string | null | undefined,
  endsOnISO: string | null | undefined,
): number {
  if (!startsOnISO || !endsOnISO) return 4;
  const start = new Date(`${startsOnISO}T00:00:00Z`).getTime();
  const end = new Date(`${endsOnISO}T00:00:00Z`).getTime();
  const days = (end - start) / DAY_MS;
  if (!Number.isFinite(days) || days <= 0) return 4;
  return Math.max(1, Math.round(days / 7));
}

/** All real occurrence instants for a recurring weekly session --
 * `firstOccurrenceAt`, plus 7/14/21... days, `weekCount` times total. */
export function allOccurrences(firstOccurrenceAt: Date, weekCount: number): Date[] {
  return Array.from(
    { length: weekCount },
    (_, i) => new Date(firstOccurrenceAt.getTime() + i * 7 * DAY_MS),
  );
}
