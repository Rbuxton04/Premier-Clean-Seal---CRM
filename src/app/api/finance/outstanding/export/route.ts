import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinance } from "@/lib/permissions";
import { getOutstanding, buildOutstandingCsv } from "@/services/finance.service";

// No dynamic segment and no request param read, so Next.js would otherwise
// try to statically prerender this at build time (and fail, since it needs
// a live DB + per-request auth) -- force it dynamic explicitly.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser().catch(() => null);
  if (!(await canViewFinance(user?.roles))) {
    return NextResponse.json({ message: "Finance is restricted to Admin, Office, and Accountant roles." }, { status: 403 });
  }

  const summary = await getOutstanding();
  const csv = buildOutstandingCsv(summary);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="outstanding.csv"`,
    },
  });
}
