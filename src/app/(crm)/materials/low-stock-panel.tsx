import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { LowStockSummary } from "@/services/materials.service";

export function LowStockPanel({ summary }: { summary: LowStockSummary }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary.count === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nothing is running low.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium">{summary.count} product{summary.count === 1 ? "" : "s"} low on stock</p>
            <ul className="space-y-1.5 text-sm">
              {summary.items.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{i.manufacturer} {i.name} ({i.colour})</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{i.stockQuantity} / {i.lowStockThreshold} {i.stockUnit}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
