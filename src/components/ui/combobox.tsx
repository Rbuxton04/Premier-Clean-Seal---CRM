"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string; meta?: Record<string, string> };

/**
 * Text input with a filtered suggestion dropdown, but unlike a native
 * <select> it always accepts arbitrary free text — used for the product
 * catalogue combobox where not every colour (e.g. a custom-mixed one) is
 * in the seeded list.
 */
export function Combobox({
  options,
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  className,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (text: string) => void;
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = (value ? options.filter((o) => o.label.toLowerCase().includes(value.toLowerCase())) : options).slice(0, 8);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
