import { DAY_LABELS_SHORT, minutesToLabel } from "@/lib/time";

export type SlotLike = { dayOfWeek: number; startMinute: number; endMinute: number };

/** Renders availability slots grouped by day, e.g. "Mon 6:00–7:00 AM, Wed 6:00–7:00 AM". */
export function formatAvailability(slots: SlotLike[]): string {
  if (slots.length === 0) return "—";
  const sorted = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
  return sorted
    .map(
      (slot) =>
        `${DAY_LABELS_SHORT[slot.dayOfWeek]} ${minutesToLabel(slot.startMinute)}–${minutesToLabel(slot.endMinute)}`,
    )
    .join(", ");
}

export const SESSION_LENGTH_LABELS: Record<string, string> = {
  "5": "5 min",
  "10": "10 min",
  "15": "15 min",
  "20": "20 min",
  "30": "30 min",
  "30_plus": "30+ min",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  new: "New",
  some_experience: "Some experience",
  experienced: "Experienced",
};
