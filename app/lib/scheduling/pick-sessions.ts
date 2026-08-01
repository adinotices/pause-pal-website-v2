import type { WeeklyInterval } from "@/lib/matching/availability";

export type CanonicalSessionSlot = {
  dayOfWeek: number; // canonical/shared timeline, not any one person's local day
  startMinute: number;
  endMinute: number;
};

/** Splits an interval at day boundaries so no piece crosses midnight --
 * keeps every chosen session slot within a single canonical day, the same
 * convention availability_slots already uses. */
function splitAtDayBoundaries(window: WeeklyInterval): WeeklyInterval[] {
  const pieces: WeeklyInterval[] = [];
  let cursor = window.start;
  while (cursor < window.end) {
    const nextBoundary = (Math.floor(cursor / 1440) + 1) * 1440;
    const pieceEnd = Math.min(window.end, nextBoundary);
    pieces.push({ start: cursor, end: pieceEnd });
    cursor = pieceEnd;
  }
  return pieces;
}

/**
 * Chooses up to `desiredSessions` weekly meeting times from a match's
 * availability overlap windows (as produced by the matching engine).
 * Prefers spreading sessions across distinct days over clustering several
 * into one long window, and only repeats a day if there aren't enough
 * distinct-day options to hit the desired count.
 */
export function pickSessionTimes(
  overlapWindows: WeeklyInterval[],
  effectiveSessionMinutes: number,
  desiredSessions: number,
): CanonicalSessionSlot[] {
  if (desiredSessions <= 0 || effectiveSessionMinutes <= 0) return [];

  type Candidate = CanonicalSessionSlot & { sourceWindowLength: number };
  const candidates: Candidate[] = [];

  for (const window of overlapWindows) {
    const windowLength = window.end - window.start;
    for (const piece of splitAtDayBoundaries(window)) {
      const day = Math.floor(piece.start / 1440) % 7;
      const dayStart = piece.start % 1440;
      const pieceLength = piece.end - piece.start;
      const chunkCount = Math.floor(pieceLength / effectiveSessionMinutes);
      for (let i = 0; i < chunkCount; i++) {
        const startMinute = dayStart + i * effectiveSessionMinutes;
        candidates.push({
          dayOfWeek: day,
          startMinute,
          endMinute: startMinute + effectiveSessionMinutes,
          // Prefer chunks from the largest *original* overlap window --
          // a stronger, more reliable signal than the day-bounded piece.
          sourceWindowLength: windowLength,
        });
      }
    }
  }

  candidates.sort(
    (a, b) => b.sourceWindowLength - a.sourceWindowLength || a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
  );

  const selected: Candidate[] = [];
  const usedDays = new Set<number>();

  // Pass 1: one session per distinct day.
  for (const candidate of candidates) {
    if (selected.length >= desiredSessions) break;
    if (usedDays.has(candidate.dayOfWeek)) continue;
    selected.push(candidate);
    usedDays.add(candidate.dayOfWeek);
  }

  // Pass 2: not enough distinct days -- allow repeats from what's left.
  if (selected.length < desiredSessions) {
    for (const candidate of candidates) {
      if (selected.length >= desiredSessions) break;
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
    }
  }

  return selected
    .map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
}
