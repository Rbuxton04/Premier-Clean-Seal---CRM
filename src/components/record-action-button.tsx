"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export type RecordActionResult = { ok: boolean; message: string };

/**
 * Generic client-side trigger for a server action that mutates a single
 * record (soft-delete, restore, etc). Uses window.confirm() rather than a
 * custom dialog component — there's no Dialog primitive in this codebase
 * yet, and a native confirm is simple, accessible, and sufficient for a
 * single yes/no gate before a destructive-looking action.
 */
export function RecordActionButton({
  label,
  pendingLabel,
  confirmMessage,
  action,
  redirectTo,
  variant = "outline",
  size = "sm",
  icon,
}: {
  label: string;
  pendingLabel?: string;
  /** If set, window.confirm(confirmMessage) must be accepted before the action runs. Omit for actions that don't need confirmation (e.g. restore). */
  confirmMessage?: string;
  action: () => Promise<RecordActionResult>;
  /** Path to navigate to on success (e.g. back to a list after deleting a detail page's record). Omit to just refresh the current page. */
  redirectTo?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (confirmMessage && typeof window !== "undefined" && !window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} disabled={pending} onClick={handleClick}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {pending ? pendingLabel ?? "Working…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
