import { NextResponse } from "next/server";
import { verifyClerkWebhookSignature } from "@/lib/messaging/webhook-verify";
import { upsertUserFromClerk, deactivateUserByClerkId } from "@/services/user.service";
import { writeAudit } from "@/lib/audit";

type ClerkEmailAddress = { id: string; email_address: string };
type ClerkUserData = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
};
type ClerkWebhookEvent = { type: string; data: ClerkUserData };

function primaryEmail(data: ClerkUserData): string | null {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find((a) => a.id === data.primary_email_address_id) ?? addresses[0];
  return primary?.email_address ?? null;
}

/**
 * Keeps our User table in sync with Clerk so staff sign-in reflects who's
 * actually in the Clerk org. Svix-signed like the Resend webhook (see
 * webhook-verify.ts) — set CLERK_WEBHOOK_SECRET from the Clerk dashboard's
 * webhook endpoint config.
 */
export async function POST(req: Request) {
  const body = await req.text();

  const ok = verifyClerkWebhookSignature({
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body,
    secret: process.env.CLERK_WEBHOOK_SECRET,
  });
  if (!ok) return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });

  let event: ClerkWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const email = primaryEmail(event.data);
        if (!email) break; // nothing usable to key on yet
        const name = [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || email;
        await upsertUserFromClerk({ clerkId: event.data.id, name, email });
        await writeAudit({ action: event.type === "user.created" ? "CREATE" : "UPDATE", resource: "user", resourceId: event.data.id, after: { email, name } });
        break;
      }
      case "user.deleted": {
        await deactivateUserByClerkId(event.data.id);
        await writeAudit({ action: "DEACTIVATE", resource: "user", resourceId: event.data.id });
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Clerk webhook handling failed", err);
    return NextResponse.json({ ok: false, message: "Webhook handling failed" }, { status: 500 });
  }
}
