import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const devMode = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar devMode={devMode} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
