import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { listUsers } from "@/services/user.service";
import { StaffTable } from "./staff-table";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, "ADMIN")) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Staff &amp; roles</h1>
        <Badge variant="warning">This page is restricted to administrators.</Badge>
      </div>
    );
  }

  let staff: Awaited<ReturnType<typeof listUsers>>;
  try {
    staff = await listUsers();
  } catch {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Staff &amp; roles</h1>
        <Badge variant="warning">Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Staff &amp; roles</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          New staff are added automatically the first time they sign in with Clerk, starting as Read only until you
          promote them here. Deactivating someone blocks sign-in immediately without deleting their history.
        </p>
      </div>

      <StaffTable staff={staff} currentUserId={user.id} />
    </div>
  );
}
