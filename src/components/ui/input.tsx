import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // text-base (16px) on the input itself, dropping to text-sm from sm:
        // up, avoids iOS Safari's auto-zoom-on-focus at font sizes under
        // 16px — a common mobile/PWA papercut. Height bumps on touchscreens
        // via pointer:coarse for a comfortable tap target.
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm [@media(pointer:coarse)]:h-11",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
export { Input };
