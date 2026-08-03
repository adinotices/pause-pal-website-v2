"use client";

import { useState, useRef, useMemo } from "react";
import { createCohortAction } from "./actions";
import { spansUSDST } from "@/lib/time";

export function NewCohortAccordion() {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const hasDSTWarning = useMemo(() => spansUSDST(startDate, endDate), [startDate, endDate]);

  return (
    <div className="mt-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer text-sm font-medium text-neutral-700 hover:text-neutral-900"
        aria-expanded={isOpen}
        aria-controls="cohort-form-content"
      >
        Open a new cohort
      </button>
      <div
        id="cohort-form-content"
        ref={contentRef}
        hidden={!isOpen}
        aria-hidden={!isOpen}
        className={isOpen ? "block" : "hidden"}
      >
        <form action={createCohortAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="number">
              Cohort number
            </label>
            <input
              id="number"
              name="number"
              type="number"
              required
              className="mt-1 w-28 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="startsOn">
              Starts on
            </label>
            <input
              id="startsOn"
              name="startsOn"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="endsOn">
              Ends on
            </label>
            <input
              id="endsOn"
              name="endsOn"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700"
          >
            Open cohort
          </button>
        </form>
        {hasDSTWarning && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            <strong>⚠️ DST transition:</strong> This cohort dates span a daylight saving time transition. Verify session times after participants confirm their timezones.
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          Opening a new cohort automatically closes signups for whichever cohort is currently
          open.
        </p>
      </div>
    </div>
  );
}
