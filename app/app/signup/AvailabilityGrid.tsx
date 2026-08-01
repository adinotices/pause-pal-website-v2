"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DAY_LABELS_SHORT, minutesToLabel } from "@/lib/time";
import type { AvailabilityInput } from "@/lib/db/queries";

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES; // 48

function slotKey(day: number, slot: number) {
  return `${day}-${slot}`;
}

/** Merges contiguous selected slots (same day, adjacent slot index) into
 * the fewest possible [startMinute, endMinute) ranges. */
function slotsToRanges(selected: Set<string>): AvailabilityInput[] {
  const ranges: AvailabilityInput[] = [];
  for (let day = 0; day < 7; day++) {
    let rangeStart: number | null = null;
    for (let slot = 0; slot <= SLOTS_PER_DAY; slot++) {
      const isSelected = slot < SLOTS_PER_DAY && selected.has(slotKey(day, slot));
      if (isSelected && rangeStart === null) {
        rangeStart = slot;
      } else if (!isSelected && rangeStart !== null) {
        ranges.push({
          dayOfWeek: day,
          startMinute: rangeStart * SLOT_MINUTES,
          endMinute: slot * SLOT_MINUTES,
        });
        rangeStart = null;
      }
    }
  }
  return ranges;
}

export default function AvailabilityGrid({
  onChange,
}: {
  onChange: (ranges: AvailabilityInput[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const dragModeRef = useRef<"select" | "deselect" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Default scroll position to roughly 6am rather than midnight.
    if (scrollRef.current) {
      const rowHeight = scrollRef.current.scrollHeight / SLOTS_PER_DAY;
      scrollRef.current.scrollTop = rowHeight * 12; // 12 slots = 6 hours
    }
  }, []);

  const applyToCell = useCallback(
    (day: number, slot: number, mode: "select" | "deselect") => {
      setSelected((prev) => {
        const next = new Set(prev);
        const key = slotKey(day, slot);
        if (mode === "select") next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    onChange(slotsToRanges(selected));
  }, [selected, onChange]);

  useEffect(() => {
    const stopDrag = () => {
      dragModeRef.current = null;
    };
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchend", stopDrag);
    return () => {
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchend", stopDrag);
    };
  }, []);

  const handleCellDown = (day: number, slot: number) => {
    const mode = selected.has(slotKey(day, slot)) ? "deselect" : "select";
    dragModeRef.current = mode;
    applyToCell(day, slot, mode);
  };

  const handleCellEnter = (day: number, slot: number) => {
    if (dragModeRef.current) {
      applyToCell(day, slot, dragModeRef.current);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragModeRef.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const day = el?.getAttribute("data-day");
    const slot = el?.getAttribute("data-slot");
    if (day !== null && slot !== null && day !== undefined && slot !== undefined) {
      applyToCell(Number(day), Number(slot), dragModeRef.current);
    }
  };

  const clearAll = () => setSelected(new Set());

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Click or drag to select the times you&apos;re usually free to meditate. All times are in{" "}
          <span className="font-medium">your local timezone</span> as selected above.
        </p>
        <button
          type="button"
          onClick={clearAll}
          className="shrink-0 text-sm text-neutral-500 underline hover:text-neutral-800"
        >
          Clear all
        </button>
      </div>
      <div
        ref={scrollRef}
        className="max-h-96 select-none overflow-y-auto rounded-lg border border-neutral-200"
        onTouchMove={handleTouchMove}
      >
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="w-14 border-b border-neutral-200 bg-white p-1"></th>
              {DAY_LABELS_SHORT.map((label) => (
                <th
                  key={label}
                  className="border-b border-l border-neutral-200 bg-white p-1 font-medium text-neutral-600"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => slot).map((slot) => (
              <tr key={slot}>
                <td className="border-b border-neutral-100 p-1 text-right text-neutral-400">
                  {slot % 2 === 0 ? minutesToLabel(slot * SLOT_MINUTES) : ""}
                </td>
                {Array.from({ length: 7 }, (_, day) => day).map((day) => {
                  const isSelected = selected.has(slotKey(day, slot));
                  return (
                    <td
                      key={day}
                      data-day={day}
                      data-slot={slot}
                      onMouseDown={() => handleCellDown(day, slot)}
                      onMouseEnter={() => handleCellEnter(day, slot)}
                      onTouchStart={() => handleCellDown(day, slot)}
                      className={`h-4 cursor-pointer border-b border-l border-neutral-100 ${
                        isSelected ? "bg-emerald-500" : "hover:bg-emerald-50"
                      }`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
