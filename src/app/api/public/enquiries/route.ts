import { NextResponse } from "next/server";
import { publicEnquiryRequestSchema } from "@/validators/enquiry";
import { createPublicEnquiry } from "@/services/enquiry.service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Minimum time (ms) a human needs to fill this form in; anything faster is
// almost certainly a bot submitting instantly on page load.
const MIN_SUBMIT_MS = 3000;

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);

  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many submissions — please try again shortly." },
      { status: 429, headers: retryAfterMs ? { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } : undefined }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = publicEnquiryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please check the form and try again.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Honeypot: a real visitor never sees or fills this field.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true, id: "ok" }); // pretend success, drop silently
  }

  // Too-fast submission is a strong bot signal.
  if (Date.now() - parsed.data.formRenderedAt < MIN_SUBMIT_MS) {
    return NextResponse.json({ ok: false, message: "Please try submitting again." }, { status: 400 });
  }

  const { website: _website, formRenderedAt: _formRenderedAt, ...enquiryData } = parsed.data;

  try {
    const enquiry = await createPublicEnquiry(enquiryData);
    return NextResponse.json({ ok: true, id: enquiry.id });
  } catch (err) {
    console.error("Failed to create public enquiry", err);
    return NextResponse.json({ ok: false, message: "Something went wrong submitting your enquiry — please call or email us directly." }, { status: 500 });
  }
}
