import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getCurrentUser } from "@/lib/auth";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const devMode = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user?.role ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar devMode={devMode} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
