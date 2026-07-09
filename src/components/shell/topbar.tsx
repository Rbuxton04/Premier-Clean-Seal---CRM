"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Role } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AccountMenu } from "@/components/shell/account-menu";
import { MobileNav } from "@/components/shell/mobile-nav";

export function Topbar({ devMode, roles }: { devMode: boolean; roles: Role[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // A lightweight entry point, not a second search engine -- it just hands
  // the query off to the full AI/keyword search experience at /search,
  // which reads ?q= and runs the search itself. See src/app/(crm)/search/.
  function runSearch() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-card px-4 sm:gap-4 sm:px-6">
      <MobileNav roles={roles} />
      <form
        className="relative min-w-0 flex-1 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <button
          type="submit"
          aria-label="Search"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4" />
        </button>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers, jobs, quotes…"
          aria-label="Search"
          className="pl-9"
        />
      </form>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {devMode && (
          <Badge variant="warning" className="hidden md:inline-flex">
            Open dev mode — add Clerk keys to enable sign-in
          </Badge>
        )}
        <AccountMenu devMode={devMode} />
      </div>
    </header>
  );
}
