"use client";

import { UserButton } from "@clerk/nextjs";
import { UserCircle2 } from "lucide-react";

/**
 * Clerk hooks/components error without a <ClerkProvider>, which only mounts
 * when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set (see root layout.tsx) — so
 * devMode must gate every Clerk import path, not just the visible UI.
 */
export function AccountMenu({ devMode }: { devMode: boolean }) {
  if (devMode) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
        title="Dev mode — sign-in disabled"
      >
        <UserCircle2 className="h-4 w-4" />
        <span className="hidden sm:inline">Dev mode</span>
      </div>
    );
  }

  return (
    <UserButton
      afterSignOutUrl="/sign-in"
      appearance={{
        elements: { avatarBox: "h-8 w-8" },
        variables: { colorPrimary: "#3C2263" },
      }}
    />
  );
}
