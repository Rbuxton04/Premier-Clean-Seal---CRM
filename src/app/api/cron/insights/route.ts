import { NextResponse } from "next/server";
import { generateWeeklyInsightReport } from "@/services/insight.service";

// A weekly Render Cron Job (see render.yaml) POSTs here with the CRON_SECRET
// header — same pattern as the Milestone 8 marketing cron.
export async function POST(req: Request) {
  const provided = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await generateWeeklyInsightReport();
    return NextResponse.json({ ok: true, id: report.id });
  } catch (err) {
    console.error("Insights cron failed", err);
    return NextResponse.json({ ok: false, message: "Cron run failed" }, { status: 500 });
  }
}
