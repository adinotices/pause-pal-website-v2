/** Shared time helpers. Availability is always stored in the signup's own
 * local time -- day-of-week + minute-of-day -- specifically to avoid DST
 * bugs: a fixed UTC offset captured at signup time silently drifts by an
 * hour whenever a cohort's 4 weeks cross a DST transition. */

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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
