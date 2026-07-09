import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinance } from "@/lib/permissions";
import { financeInvoiceFilterQuerySchema, financeStatusFilterValues } from "@/validators/finance";
import { resolveFinancePeriod, listFinanceInvoices, buildInvoicesCsv } from "@/services/finance.service";

// Server-generated CSV export for the accountant's own software (Xero,
// QuickBooks, Sage, a spreadsheet, ...). Role-checked here explicitly since
// this route sits outside the (crm) layout's ACCOUNTANT redirect guard.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser().catch(() => null);
  if (!(await canViewFinance(user?.roles))) {
    return NextResponse.json({ message: "Finance is restricted to Admin, Office, and Accountant roles." }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = financeInvoiceFilterQuerySchema.safeParse({
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  const { period: preset, from, to, status } = parsed.success
    ? parsed.data
    : { period: "month" as const, from: undefined, to: undefined, status: undefined };
  const period = resolveFinancePeriod(preset, from, to);
  const statusFilter = financeStatusFilterValues.find((s) => s === status);

  const rows = await listFinanceInvoices({ status: statusFilter, from: period.from, to: period.to });
  const csv = buildInvoicesCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${period.preset}.csv"`,
    },
  });
}
