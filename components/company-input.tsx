"use client";

import { useId, useRef, useState } from "react";
import { COMPANY_SUGGESTIONS } from "@/lib/companies";
import { Input } from "@/components/ui/input";

const MIN_QUERY = 2;
const MAX_RESULTS = 6;

/**
 * Company field with suggestions.
 *
 * Unlike a native <datalist>, this shows nothing until there is something to
 * narrow on — dropping 280 companies on someone the moment they focus the
 * field is noise, not help. It also never constrains the value: whatever is
 * typed is what gets saved.
 */
export function CompanyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim().toLowerCase();

  const matches =
    query.length < MIN_QUERY
      ? []
      : COMPANY_SUGGESTIONS.filter((company) =>
          company.toLowerCase().includes(query),
        ).slice(0, MAX_RESULTS);

  // Once the typed value *is* the suggestion, repeating it back is clutter.
  const exactMatch =
    matches.length === 1 && matches[0].toLowerCase() === query;

  const showList = open && matches.length > 0 && !exactMatch;

  function choose(company: string) {
    onChange(company);
    setOpen(false);
    setHighlighted(0);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on an option lands before the list unmounts.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (!showList) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((index) => (index + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted(
              (index) => (index - 1 + matches.length) % matches.length,
            );
          } else if (event.key === "Enter") {
            // Only swallow Enter when a suggestion is actually highlighted,
            // so the form still submits normally otherwise.
            event.preventDefault();
            choose(matches[highlighted]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
        >
          {matches.map((company, index) => (
            <li key={company}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                // onMouseDown fires before onBlur, so the click is not lost.
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  choose(company);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={`w-full px-3 py-2 text-left text-sm ${
                  index === highlighted ? "bg-muted" : ""
                }`}
              >
                {company}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
