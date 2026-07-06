import { NextResponse } from "next/server";
import { runDueReminders } from "@/services/marketing.service";

// Render's free-tier web service sleeps, so a Render Cron Job (see
// render.yaml) POSTs here every morning with the CRON_SECRET header. Batches
// are bounded inside runDueReminders() to stay within free-tier limits.
export async function POST(req: Request) {
  const provided = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Marketing cron failed", err);
    return NextResponse.json({ ok: false, message: "Cron run failed" }, { status: 500 });
  }
}
