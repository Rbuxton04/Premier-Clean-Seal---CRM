/**
 * Resend email seam for Milestone 8 marketing sends — distinct from the
 * transactional quote email in src/lib/email/resend.ts. Same graceful
 * no-op pattern: until RESEND_API_KEY is set, isEmailConfigured() is false
 * and callers (the marketing cron) leave the reminder SCHEDULED rather than
 * attempting to send. Uses raw fetch against Resend's REST API to keep the
 * dependency footprint down, same as the other provider seams.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = "Premier Clean & Seal <marketing@premiercleanandseal.co.uk>";

export type SendMarketingEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendResult = { messageId: string };

export async function sendMarketingEmail(input: SendMarketingEmailInput): Promise<SendResult> {
  if (!isEmailConfigured()) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { id: string };
  return { messageId: json.id };
}
