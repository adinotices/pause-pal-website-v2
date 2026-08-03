/** Shared time helpers. Availability is always stored in the signup's own
 * local time -- day-of-week + minute-of-day -- specifically to avoid DST
 * bugs: a fixed UTC offset captured at signup time silently drifts by an
 * hour whenever a cohort's 4 weeks cross a DST transition. */

export const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function minutesToLabel(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

/** Renders a real instant (e.g. a computed session's firstOccurrenceAt) in
 * a specific person's timezone -- e.g. "Mon, 6:00 AM". Used to show admins
 * exactly what local time a proposed session lands at for each member,
 * since a UTC-anchored instant alone doesn't reveal that. */
export function formatInstantForTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Best-effort guess at the browser's IANA timezone. Always shown to the
 * user for confirmation rather than trusted blindly. */
export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York";
  }
}

/** The nth (1-indexed) occurrence of `weekday` (0=Sunday) in `month`
 * (0=January) of `year`, at local midnight. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

/** US daylight saving time transitions for `year` -- 2nd Sunday of March
 * (spring forward) and 1st Sunday of November (fall back), per the Energy
 * Policy Act of 2005. Computed rather than hardcoded to specific calendar
 * dates so this doesn't silently stop working once a year with dates
 * nobody thought to type in arrives. Deliberately US-specific (matching
 * the app's primary audience); not accurate for timezones that follow a
 * different DST convention (the EU's last-Sunday-of-March/October rule,
 * the Southern Hemisphere's inverted schedule, or none at all). */
export function usDSTTransitions(year: number): { springForward: Date; fallBack: Date } {
  return {
    springForward: nthWeekdayOfMonth(year, 2, 0, 2),
    fallBack: nthWeekdayOfMonth(year, 10, 0, 1),
  };
}

/** Whether the [startDate, endDate] range (inclusive, as ISO date strings)
 * crosses a US DST transition -- used to warn an admin that a cohort's
 * session times may need a manual look once participants confirm their
 * timezones (see the module doc comment above for why storing local time
 * doesn't fully solve this on its own). */
export function spansUSDST(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    const { springForward, fallBack } = usDSTTransitions(year);
    if (
      (start <= springForward && end >= springForward) ||
      (start <= fallBack && end >= fallBack)
    ) {
      return true;
    }
  }

  return false;
}

/** A reasonably short list of common IANA zones for a <select>, with the
 * guessed zone always included even if it's not in the curated list. */
export const COMMON_TIMEZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];
