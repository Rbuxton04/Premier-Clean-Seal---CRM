import { formatGBP } from "@/lib/utils";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";

export type PreviewLineItem = { description: string; quantity: number; unit: string; unitPrice: number };

export function QuotePreview({
  quoteNumber,
  customerName,
  customerCompany,
  propertyAddress,
  scopeOfWorks,
  lineItems,
  subtotal,
  vatApplied,
  vatRatePercent,
  vatAmount,
  total,
  depositAmount,
  terms,
  warrantyMonths,
  createdAt,
  expiresAt,
}: {
  quoteNumber: string;
  customerName: string;
  customerCompany?: string | null;
  propertyAddress?: string | null;
  scopeOfWorks: string;
  lineItems: PreviewLineItem[];
  subtotal: number;
  vatApplied: boolean;
  vatRatePercent: number;
  vatAmount: number;
  total: number;
  depositAmount?: number | null;
  terms?: string | null;
  warrantyMonths?: number | null;
  createdAt?: Date;
  expiresAt?: Date | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-sm font-semibold tracking-[0.18em] text-brand-plum">PREMIER CLEAN &amp; SEAL</p>
          <BrandSwoosh className="mt-1 h-2 w-32 text-brand-plum" />
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold text-brand-plum">{quoteNumber || "Draft"}</p>
          {createdAt && <p className="text-xs text-muted-foreground">Issued {createdAt.toLocaleDateString("en-GB")}</p>}
          {expiresAt && <p className="text-xs text-muted-foreground">Valid until {expiresAt.toLocaleDateString("en-GB")}</p>}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Quote for</p>
        <p className="font-medium">{customerName || "—"}</p>
        {customerCompany && <p className="text-sm text-muted-foreground">{customerCompany}</p>}
        {propertyAddress && <p className="text-sm text-muted-foreground">{propertyAddress}</p>}
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope of works</p>
        <p className="whitespace-pre-wrap text-sm">{scopeOfWorks || "—"}</p>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-brand-plum text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 font-medium">Description</th>
            <th className="py-1.5 text-right font-medium">Qty</th>
            <th className="py-1.5 font-medium">Unit</th>
            <th className="py-1.5 text-right font-medium">Price</th>
            <th className="py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, i) => (
            <tr key={i} className="border-b">
              <td className="py-1.5 pr-2">{item.description || "—"}</td>
              <td className="py-1.5 text-right">{item.quantity}</td>
              <td className="py-1.5">{item.unit}</td>
              <td className="py-1.5 text-right">{formatGBP(item.unitPrice)}</td>
              <td className="py-1.5 text-right">{formatGBP(item.quantity * item.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-3 w-56 space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span><span>{formatGBP(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{vatApplied ? `VAT (${vatRatePercent}%)` : "VAT (not registered)"}</span><span>{formatGBP(vatAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-brand-plum pt-1.5 font-display text-base font-semibold">
          <span>Total</span><span className="text-brand-plum">{formatGBP(total)}</span>
        </div>
        {depositAmount ? (
          <div className="flex justify-between text-muted-foreground">
            <span>Deposit due</span><span>{formatGBP(depositAmount)}</span>
          </div>
        ) : null}
      </div>

      {warrantyMonths != null && (
        <p className="mt-4 text-xs text-muted-foreground">Covered by a {warrantyMonths}-month warranty against installation defects.</p>
      )}
      {terms && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Terms</p>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{terms}</p>
        </div>
      )}

      <div className="mt-5 rounded-md bg-brand-plum-soft p-3 text-sm">
        <p className="font-medium text-brand-plum">Approve &amp; sign online</p>
        <p className="mt-1 text-xs text-muted-foreground">Customers can review and approve this quote with a typed signature from their own device.</p>
      </div>
    </div>
  );
}
