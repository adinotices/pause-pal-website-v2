"use client";

import { useState, useRef } from "react";
import { createCohortAction } from "./actions";

export function NewCohortAccordion() {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
        <p className="mt-2 text-xs text-neutral-500">
          Opening a new cohort automatically closes signups for whichever cohort is currently
          open.
        </p>
      </div>
    </div>
  );
}
