import { NextResponse } from "next/server";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { exportCustomerData } from "@/services/gdpr.service";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: { customerId: string } }) {
  try {
    const user = await requireAdmin();
    const data = await exportCustomerData(params.customerId);
    if (!data) return NextResponse.json({ ok: false, message: "Customer not found" }, { status: 404 });

    await writeAudit({
      userId: user.id,
      action: "EXPORT",
      resource: "customer.gdpr",
      resourceId: params.customerId,
      ip: getClientIp(req.headers),
    });

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="customer-${params.customerId}-export.json"`,
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ ok: false, message: err.message }, { status: 403 });
    console.error("GDPR export failed", err);
    return NextResponse.json({ ok: false, message: "Export failed" }, { status: 500 });
  }
}
