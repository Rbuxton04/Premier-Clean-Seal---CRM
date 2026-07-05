import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function Topbar({ devMode }: { devMode: boolean }) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
      <div className="w-full max-w-md">
        <Input placeholder="Search customers, jobs, quotes…  (⌘K coming soon)" aria-label="Search" />
      </div>
      <div className="ml-auto flex items-center gap-3">
        {devMode && <Badge variant="warning">Open dev mode — add Clerk keys to enable sign-in</Badge>}
      </div>
    </header>
  );
}
