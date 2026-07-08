import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { getFinanceOverview, type FinanceOverview } from "@/services/finance.service";
import { PeriodSelector } from "../period-selector";
import { parsePeriod } from "../parse-period";

export const dynamic = "force-dynamic";

async function loadOverview(searchParams: Record<string, string | string[] | undefined>): Promise<FinanceOverview | null> {
  try {
    return await getFinanceOverview(parsePeriod(searchParams));
  } catch {
    return null;
  }
}

export default async function FinanceVatPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const overview = await loadOverview(searchParams);

  if (!overview) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load the VAT summary right now — try again shortly.</p>;
  }

  const { vat } = overview;

  return (
    <div className="space-y-6">
      <PeriodSelector basePath="/finance/vat" current={overview.period.preset} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">VAT position — {overview.period.label}</CardTitle>
          <CardDescription>
            {vat.registered
              ? `Registered at ${vat.ratePercent}%. Figures below reflect the VAT rate in effect when each invoice was issued, so past invoices never change retroactively if the rate changes.`
              : "Premier Clean & Seal is not currently VAT registered, so every invoice charges £0 VAT. This page is structured to show real figures the moment registration happens — nothing else needs to change."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {vat.registered ? (
              <Badge variant="success">VAT registered — {vat.ratePercent}%</Badge>
            ) : (
              <Badge variant="warning">Not registered — £0 VAT</Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net (excl. VAT)</p>
              <p className="font-display text-lg font-semibold">{formatGBP(vat.netInPeriod)}</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">VAT</p>
              <p className="font-display text-lg font-semibold">{formatGBP(vat.vatInPeriod)}</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross (incl. VAT)</p>
              <p className="font-display text-lg font-semibold text-brand-plum">{formatGBP(vat.grossInPeriod)}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Based on invoices issued in this period, excluding voided invoices. This is a summary for your own bookkeeping software, not a
            submitted VAT return — always reconcile against your accounting records before filing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
