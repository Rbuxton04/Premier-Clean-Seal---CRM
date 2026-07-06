"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled application error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        We&apos;ve logged the problem. Please try again, or contact us directly if it keeps happening.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-brand-plum px-4 py-2 text-sm font-medium text-white hover:bg-brand-plum/90"
      >
        Try again
      </button>
    </div>
  );
}
