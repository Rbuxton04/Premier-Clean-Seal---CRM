import { NextResponse } from "next/server";
import { verifyTwilioSignature } from "@/lib/messaging/webhook-verify";
import { handleInboundSms, handleSmsStatusCallback } from "@/services/marketing.service";

// One endpoint handles both Twilio callback shapes: inbound messages
// (configured on the phone number, always includes Body + From) and
// delivery status callbacks (StatusCallback param set on each send in
// marketing.service.ts, includes MessageStatus + MessageSid instead).
export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const ok = verifyTwilioSignature({
    url: req.url,
    params,
    signature: req.headers.get("x-twilio-signature"),
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });
  if (!ok) return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });

  if (params.Body !== undefined && params.From) {
    await handleInboundSms(params.From, params.Body);
  } else if (params.MessageStatus && params.MessageSid) {
    await handleSmsStatusCallback(params.MessageSid, params.MessageStatus);
  }

  // No auto-reply — empty TwiML acknowledges receipt.
  return new NextResponse("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });
}
