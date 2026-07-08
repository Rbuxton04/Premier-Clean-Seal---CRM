import * as React from "react";
import { cn } from "@/lib/utils";

/** Lightweight native select styled to match the shadcn inputs. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        // See Input for why text-base (not text-sm) at the base size — avoids
        // iOS Safari zooming the page in when a select gains focus.
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm [@media(pointer:coarse)]:h-11",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
export { Select };
