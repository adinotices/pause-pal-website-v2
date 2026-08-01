/**
 * Resolves the UTC offset (in minutes, positive = ahead of UTC) of an IANA
 * timezone on a specific calendar date. Used to project everyone's local
 * weekly availability into one shared timeline for matching.
 *
 * Deliberately takes a `dateISO` (the cohort's actual start date) rather
 * than "now" -- offsets change across DST transitions, so resolving against
 * the date the cohort actually runs is the only way to get a correct
 * snapshot for that cohort, rather than one that happens to be right today
 * and wrong once the clocks change.
 */
export function utcOffsetMinutes(timeZone: string, dateISO: string): number {
  // Noon UTC as the reference instant, comfortably clear of any DST
  // transition that happens to fall on this exact date.
  const reference = new Date(`${dateISO}T12:00:00Z`);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(reference);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  // Reinterpret the wall-clock time shown in `timeZone` as if it were UTC;
  // the difference from the true UTC instant is the zone's offset.
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return Math.round((asIfUtc - reference.getTime()) / 60000);
}
