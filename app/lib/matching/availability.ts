export const MINUTES_PER_WEEK = 7 * 24 * 60; // 10080

export type LocalSlot = { dayOfWeek: number; startMinute: number; endMinute: number };
export type WeeklyInterval = { start: number; end: number };

/**
 * Projects a person's local weekly availability into a canonical timeline
 * shared by everyone, regardless of timezone: minutes since "Sunday 00:00,
 * UTC-equivalent for this cohort's start date". Each local slot maps to
 * `localMinuteOfWeek - offsetMinutes`, wrapping (and splitting, if
 * necessary) around the 7-day cycle.
 */
export function toCanonicalIntervals(
  slots: LocalSlot[],
  offsetMinutes: number,
): WeeklyInterval[] {
  const intervals: WeeklyInterval[] = [];

  for (const slot of slots) {
    const duration = slot.endMinute - slot.startMinute;
    if (duration <= 0) continue;

    const localMinuteOfWeek = slot.dayOfWeek * 1440 + slot.startMinute;
    const start = mod(localMinuteOfWeek - offsetMinutes, MINUTES_PER_WEEK);
    const end = start + duration;

    if (end <= MINUTES_PER_WEEK) {
      intervals.push({ start, end });
    } else {
      // Wraps past the end of the week back to the beginning.
      intervals.push({ start, end: MINUTES_PER_WEEK });
      intervals.push({ start: 0, end: end - MINUTES_PER_WEEK });
    }
  }

  return mergeIntervals(intervals);
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function mergeIntervals(intervals: WeeklyInterval[]): WeeklyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: WeeklyInterval[] = [sorted[0]];
  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/** Pairwise intersection of two sorted, non-overlapping interval sets. */
export function intersectIntervals(
  a: WeeklyInterval[],
  b: WeeklyInterval[],
): WeeklyInterval[] {
  const result: WeeklyInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (start < end) result.push({ start, end });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return result;
}

export type OverlapSummary = {
  windows: WeeklyInterval[];
  totalOverlapMinutes: number;
  /** How many independent sessions of `minSessionMinutes` fit across all
   * overlap windows combined -- i.e. how many distinct weekly meeting slots
   * of at least that length this group could actually use. */
  sessionsAvailable: number;
};

/** Summarizes the shared availability across two or more people's
 * canonical interval sets (a pair is the common case; a trio -- see
 * lib/matching/solve.ts's odd-person-out fallback -- reduces all three
 * pairwise via the same intersectIntervals used here). */
export function summarizeOverlap(
  intervalSets: WeeklyInterval[][],
  minSessionMinutes: number,
): OverlapSummary {
  const windows = intervalSets.reduce(intersectIntervals);
  let totalOverlapMinutes = 0;
  let sessionsAvailable = 0;
  for (const w of windows) {
    const length = w.end - w.start;
    totalOverlapMinutes += length;
    sessionsAvailable += Math.floor(length / minSessionMinutes);
  }
  return { windows, totalOverlapMinutes, sessionsAvailable };
}
