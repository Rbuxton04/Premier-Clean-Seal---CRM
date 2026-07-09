import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinance } from "@/lib/permissions";
import { financePeriodQuerySchema } from "@/validators/finance";
import { resolveFinancePeriod, getFinanceOverview, buildSummaryCsv } from "@/services/finance.service";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser().catch(() => null);
  if (!(await canViewFinance(user?.roles))) {
    return NextResponse.json({ message: "Finance is restricted to Admin, Office, and Accountant roles." }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = financePeriodQuerySchema.safeParse({
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const { period: preset, from, to } = parsed.success ? parsed.data : { period: "month" as const, from: undefined, to: undefined };
  const period = resolveFinancePeriod(preset, from, to);

  const overview = await getFinanceOverview(period);
  const csv = buildSummaryCsv(overview);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-summary-${period.preset}.csv"`,
    },
  });
}
