import { NextResponse } from "next/server";
import { verifyResendSignature } from "@/lib/messaging/webhook-verify";
import { markReminderStatusByMessageId, handleEmailComplaint } from "@/services/marketing.service";

type ResendEvent = { type?: string; data?: { email_id?: string } };

export async function POST(req: Request) {
  const body = await req.text();

  const ok = verifyResendSignature({
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body,
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });
  if (!ok) return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  const messageId = event.data?.email_id;
  if (!messageId) return NextResponse.json({ ok: true });

  switch (event.type) {
    case "email.opened":
      await markReminderStatusByMessageId(messageId, "OPENED", ["SENT"]);
      break;
    case "email.clicked":
      await markReminderStatusByMessageId(messageId, "CLICKED", ["SENT", "OPENED"]);
      break;
    case "email.bounced":
      await markReminderStatusByMessageId(messageId, "FAILED");
      break;
    case "email.complained":
      await handleEmailComplaint(messageId);
      break;
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
