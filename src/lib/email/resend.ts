/**
 * Resend email seam. Until RESEND_API_KEY is set, isResendConfigured() is
 * false and callers should fall back to showing the approval link in-app
 * for staff to send manually — nothing here is called yet. Uses raw fetch
 * against Resend's REST API rather than their SDK, since this is the only
 * call site and it keeps the dependency footprint down.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendQuoteEmailInput = {
  to: string;
  customerName: string;
  quoteNumber: string;
  approvalUrl: string;
  pdfBuffer?: Buffer;
};

const FROM_ADDRESS = "Premier Clean & Seal <quotes@premiercleanandseal.co.uk>";

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<void> {
  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const html = `
    <p>Hi ${input.customerName},</p>
    <p>Please find your quote <strong>${input.quoteNumber}</strong> from Premier Clean &amp; Seal attached.</p>
    <p><a href="${input.approvalUrl}">View and approve your quote online</a></p>
    <p>This link lets you review the full breakdown, approve or decline, and see our warranty terms.</p>
    <p>Thanks,<br/>Premier Clean &amp; Seal</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [input.to],
      subject: `Your quote ${input.quoteNumber} from Premier Clean & Seal`,
      html,
      attachments: input.pdfBuffer
        ? [{ filename: `${input.quoteNumber}.pdf`, content: input.pdfBuffer.toString("base64") }]
        : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

export type SendPortalLinkEmailInput = {
  to: string;
  customerName: string;
  url: string;
};

export async function sendPortalLinkEmail(input: SendPortalLinkEmailInput): Promise<void> {
  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const html = `
    <p>Hi ${input.customerName},</p>
    <p>You can view your quotes, invoices, warranty certificates and job photos with Premier Clean &amp; Seal any time using your own customer portal:</p>
    <p><a href="${input.url}">Open your customer portal</a></p>
    <p>No password needed — this link is just for you. If you didn't expect this email, please ignore it.</p>
    <p>Thanks,<br/>Premier Clean &amp; Seal</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [input.to],
      subject: "Your Premier Clean & Seal customer portal",
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
