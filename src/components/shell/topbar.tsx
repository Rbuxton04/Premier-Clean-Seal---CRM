import type { Role } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AccountMenu } from "@/components/shell/account-menu";
import { MobileNav } from "@/components/shell/mobile-nav";

export function Topbar({ devMode, roles }: { devMode: boolean; roles: Role[] }) {
  return (
    <header className="flex h-14 items-center gap-2 border-b bg-card px-4 sm:gap-4 sm:px-6">
      <MobileNav roles={roles} />
      <div className="min-w-0 flex-1 max-w-md">
        <Input placeholder="Search customers, jobs, quotes…  (⌘K coming soon)" aria-label="Search" />
      </div>
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
