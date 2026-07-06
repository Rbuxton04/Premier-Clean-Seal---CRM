/**
 * Twilio SMS seam. Uses raw fetch against Twilio's REST API rather than
 * their SDK to keep the dependency footprint down (same approach as the
 * Resend email seam). Until all three TWILIO_* vars are set,
 * isSmsConfigured() is false and callers (the marketing cron) leave the
 * reminder SCHEDULED rather than attempting to send.
 */
export function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export type SendSmsInput = { to: string; body: string; statusCallbackUrl?: string };
export type SendResult = { messageId: string };

export async function sendSms(input: SendSmsInput): Promise<SendResult> {
  if (!isSmsConfigured()) {
    throw new Error("TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM are not set.");
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const body = new URLSearchParams({
    To: input.to,
    From: process.env.TWILIO_FROM!,
    Body: input.body,
    ...(input.statusCallbackUrl ? { StatusCallback: input.statusCallbackUrl } : {}),
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio API error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { sid: string };
  return { messageId: json.sid };
}
