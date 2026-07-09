import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getCurrentUser } from "@/lib/auth";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const devMode = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const user = await getCurrentUser().catch(() => null);
  const roles = user?.roles ?? [];

  // ACCOUNTANT is read-only and finance-scoped — this is the server-side
  // enforcement point for "restricted to finance routes", re-checked on
  // every full navigation (not just a hidden sidebar link). Roles are
  // additive, so this only fires when ACCOUNTANT is someone's ONLY role —
  // an ADMIN/OFFICE user who also happens to hold ACCOUNTANT keeps full
  // access, most-permissive-wins. x-pathname is set by middleware.ts, since
  // a Server Component can't read the current URL directly. Falls open (no
  // redirect) if the header is ever missing rather than risk
  // redirect-looping on a route it can't identify.
  if (roles.length === 1 && roles[0] === "ACCOUNTANT") {
    const pathname = headers().get("x-pathname");
    if (pathname && !pathname.startsWith("/finance")) {
      redirect("/finance");
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar roles={roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar devMode={devMode} roles={roles} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
