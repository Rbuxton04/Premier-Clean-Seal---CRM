import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { computeReadiness, type ReadinessStatus } from "@/services/readiness.service";

export const dynamic = "force-dynamic";

const statusIcon: Record<ReadinessStatus, JSX.Element> = {
  green: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  amber: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  red: <XCircle className="h-5 w-5 text-red-600" />,
};

export default async function SecurityReadinessPage() {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, "ADMIN")) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Go-live readiness</h1>
        <Badge variant="warning">This page is restricted to administrators.</Badge>
      </div>
    );
  }

  let items: Awaited<ReturnType<typeof computeReadiness>>;
  try {
    items = await computeReadiness();
  } catch {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Go-live readiness</h1>
        <Badge variant="warning">Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed</Badge>
      </div>
    );
  }
  const redCount = items.filter((i) => i.status === "red").length;
  const amberCount = items.filter((i) => i.status === "amber").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Go-live readiness</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A live snapshot of what's safe before this holds real customer data. This checklist is tooling, not legal
          advice — GDPR compliance, a retention policy, and a privacy notice remain the operator's responsibility.
        </p>
      </div>

      {redCount > 0 ? (
        <Badge variant="warning">{redCount} item{redCount === 1 ? "" : "s"} need attention before go-live.</Badge>
      ) : amberCount > 0 ? (
        <Badge variant="warning">{amberCount} item{amberCount === 1 ? "" : "s"} worth reviewing.</Badge>
      ) : (
        <Badge variant="success">Everything checked out green.</Badge>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {statusIcon[item.status]}
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="text-muted-foreground">{item.detail}</p>
              {item.howToFix && <p className="text-xs font-medium text-brand-plum">How to fix: {item.howToFix}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
