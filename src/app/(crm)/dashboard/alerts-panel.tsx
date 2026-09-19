import Link from "next/link";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AlertItem } from "@/services/alerts.service";

const severityStyles: Record<AlertItem["severity"], string> = {
  red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200",
  amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200",
};

/** Dashboard "Alerts & Updates" -- surfaces certification expiry and overdue invoices (plus optional secondary nudges) so important things arrive on the dashboard rather than being hunted for. See getAlerts() in alerts.service.ts. */
export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-brand-plum" /> Alerts &amp; updates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> All up to date — nothing needs attention.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-80", severityStyles[a.severity])}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{a.message}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
