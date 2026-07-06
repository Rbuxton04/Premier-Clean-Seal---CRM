import { NextResponse } from "next/server";
import { runBackup } from "@/services/backup.service";

// Same CRON_SECRET pattern as the marketing/insights crons (see render.yaml).
export async function POST(req: Request) {
  const provided = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBackup();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Backup cron failed", err);
    return NextResponse.json({ ok: false, message: "Backup run failed" }, { status: 500 });
  }
}
