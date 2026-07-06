import { randomBytes } from "crypto";
import type { ReminderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { isAiConfigured, getAiProvider } from "@/lib/ai";
import { isEmailConfigured, sendMarketingEmail } from "@/lib/messaging/email";
import { isSmsConfigured, sendSms } from "@/lib/messaging/sms";
import { applicationAreaLabels } from "@/validators/completion";
import {
  marketingToneLabels,
  marketingChannelLabels,
  marketingChannelRules,
  type GenerateCampaignInput,
  type RebookingRequestInput,
} from "@/validators/marketing";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Customer-facing tokens (reuses PortalToken — see the schema note in the
// Milestone 8 brief: "add a field or reuse a token table"). One long-lived
// token per customer serves both the unsubscribe link and the rebooking
// link sent in every marketing message.
// ---------------------------------------------------------------------------

const MARKETING_SCOPE = "marketing";

export async function getOrCreateMarketingToken(customerId: string): Promise<string> {
  const existing = await db.portalToken.findFirst({
    where: { customerId, scope: { has: MARKETING_SCOPE }, expiresAt: { gt: new Date() } },
    select: { token: true },
  });
  if (existing) return existing.token;

  const token = randomBytes(24).toString("hex");
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 10);
  await db.portalToken.create({ data: { customerId, token, scope: [MARKETING_SCOPE], expiresAt: farFuture } });
  return token;
}

export type MarketingTokenCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  marketingEmail: boolean;
  marketingSms: boolean;
};

export async function resolveMarketingToken(token: string): Promise<MarketingTokenCustomer | null> {
  const portalToken = await db.portalToken.findFirst({
    where: { token, scope: { has: MARKETING_SCOPE }, expiresAt: { gt: new Date() } },
    select: { customerId: true },
  });
  if (!portalToken) return null;

  return db.customer.findFirst({
    where: { id: portalToken.customerId, deletedAt: null },
    select: { id: true, name: true, email: true, phone: true, marketingEmail: true, marketingSms: true },
  });
}

export type RebookingCustomer = {
  id: string;
  name: string;
  properties: Array<{ id: string; addressLine1: string; postcode: string }>;
};

export async function getRebookingCustomer(token: string): Promise<RebookingCustomer | null> {
  const portalToken = await db.portalToken.findFirst({
    where: { token, scope: { has: MARKETING_SCOPE }, expiresAt: { gt: new Date() } },
    select: { customerId: true },
  });
  if (!portalToken) return null;

  return db.customer.findFirst({
    where: { id: portalToken.customerId, deletedAt: null },
    select: { id: true, name: true, properties: { select: { id: true, addressLine1: true, postcode: true } } },
  });
}

// ---------------------------------------------------------------------------
// Personalisation — merge fields + branded templates
// ---------------------------------------------------------------------------

export type ReminderMergeData = {
  firstName: string;
  jobType: string;
  product: string;
  colour: string;
  monthsAgo: string;
  completedDate: string;
  property: string;
  technician: string;
  bookLink: string;
};

function renderMergeFields(template: string, data: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in data ? data[key] : match));
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

type ReminderForMerge = {
  customer: { name: string };
  job: {
    actualEnd: Date | null;
    property: { addressLine1: string; postcode: string } | null;
    technician: { name: string } | null;
    materials: Array<{ applicationArea: string; product: { manufacturer: string; name: string; colour: string } }>;
  };
};

function buildMergeData(reminder: ReminderForMerge, bookLink: string): ReminderMergeData {
  const primary = reminder.job.materials[0];
  const completedDate = reminder.job.actualEnd ?? new Date();
  return {
    firstName: reminder.customer.name.split(" ")[0] || reminder.customer.name,
    jobType: primary ? (applicationAreaLabels[primary.applicationArea as keyof typeof applicationAreaLabels] ?? "sealant work") : "sealant work",
    product: primary ? `${primary.product.manufacturer} ${primary.product.name}` : "silicone sealant",
    colour: primary?.product.colour ?? "your chosen colour",
    monthsAgo: String(monthsBetween(completedDate, new Date())),
    completedDate: completedDate.toLocaleDateString("en-GB"),
    property: reminder.job.property ? `${reminder.job.property.addressLine1}, ${reminder.job.property.postcode}` : "your property",
    technician: reminder.job.technician?.name ?? "our team",
    bookLink,
  };
}

const DEFAULT_REMINDER_SUBJECT = "Time for a sealant check-up, {firstName}?";
const DEFAULT_REMINDER_EMAIL_BODY =
  "Hi {firstName},\n\nIt's been about {monthsAgo} months since {technician} completed {jobType} at {property} using {product} in {colour}. Silicone typically starts to wear after 12-18 months, especially in bathrooms and kitchens — it might be worth a free check.\n\nThanks,\nPremier Clean & Seal";
const DEFAULT_REMINDER_SMS_BODY =
  "Hi {firstName}, it's about {monthsAgo} months since we resealed at {property}. Worth a free check? Book: {bookLink} Reply STOP to opt out.";

function wrapEmailHtml({ bodyText, bookLink, unsubscribeUrl }: { bodyText: string; bookLink: string; unsubscribeUrl: string }): string {
  const logoUrl = `${appUrl()}/logo.png`;
  const paragraphs = bodyText
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color:#2E333B;">
    <div style="padding:20px 0;">
      <img src="${logoUrl}" width="40" height="40" alt="Premier Clean & Seal" style="border-radius:6px; display:block;" />
      <div style="margin-top:8px; height:3px; width:120px; background:#3C2263; border-radius:2px;"></div>
    </div>
    <div style="font-size:14px; line-height:1.6;">${paragraphs}</div>
    <div style="text-align:center; margin:24px 0;">
      <a href="${bookLink}" style="background:#3C2263; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-size:14px; font-weight:600; display:inline-block;">
        Book a free re-check
      </a>
    </div>
    <hr style="border:none; border-top:1px solid #E0E0E0; margin:24px 0;" />
    <p style="font-size:11px; color:#8A93A0; line-height:1.5;">
      Premier Clean &amp; Seal, Wigan. You're receiving this because you're a past customer.
      <a href="${unsubscribeUrl}" style="color:#3C2263;">Unsubscribe from marketing emails</a>.
    </p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Upcoming reminders — list, cancel, reschedule
// ---------------------------------------------------------------------------

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type ReminderListItem = {
  id: string;
  dueDate: Date;
  intervalMonths: number;
  channels: string[];
  status: string;
  customer: { id: string; name: string; marketingEmail: boolean; marketingSms: boolean };
  job: { id: string; jobNumber: string; materials: Array<{ product: { colour: string } }> };
};

export async function listUpcomingReminders(limit = 20): Promise<ReminderListItem[]> {
  const rows = await db.marketingReminder.findMany({
    where: { organisationId: ORG_ID, status: "SCHEDULED" },
    include: {
      customer: { select: { id: true, name: true, marketingEmail: true, marketingSms: true } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          materials: { take: 1, select: { product: { select: { colour: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
  return rows as ReminderListItem[];
}

export async function cancelReminder(id: string): Promise<void> {
  await db.marketingReminder.update({ where: { id }, data: { status: "CANCELLED" } });
}

export async function rescheduleReminder(id: string, dueDate: Date): Promise<void> {
  await db.marketingReminder.update({ where: { id }, data: { dueDate } });
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export type MarketingStats = {
  sentCount: number;
  openRate: number;
  clickRate: number;
  repliesCount: number;
  conversionsCount: number;
  repeatRevenue: number;
  repeatCustomersCount: number;
};

export async function getMarketingStats(): Promise<MarketingStats> {
  const [sentCount, openedOrBeyond, clickedOrBeyond, repliesCount, conversionsCount] = await Promise.all([
    db.marketingReminder.count({ where: { organisationId: ORG_ID, status: { in: ["SENT", "OPENED", "CLICKED", "REPLIED", "CONVERTED"] } } }),
    db.marketingReminder.count({ where: { organisationId: ORG_ID, status: { in: ["OPENED", "CLICKED", "REPLIED", "CONVERTED"] } } }),
    db.marketingReminder.count({ where: { organisationId: ORG_ID, status: { in: ["CLICKED", "REPLIED", "CONVERTED"] } } }),
    db.marketingReminder.count({ where: { organisationId: ORG_ID, status: "REPLIED" } }),
    db.marketingReminder.count({ where: { organisationId: ORG_ID, status: "CONVERTED" } }),
  ]);

  const openRate = sentCount > 0 ? Math.round((openedOrBeyond / sentCount) * 100) : 0;
  const clickRate = sentCount > 0 ? Math.round((clickedOrBeyond / sentCount) * 100) : 0;

  // Repeat business: customers with more than one completed job, and the
  // revenue from every job after their first with us.
  const completedJobs = await db.job.findMany({
    where: { organisationId: ORG_ID, status: "COMPLETED" },
    select: { customerId: true, price: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const byCustomer = new Map<string, Array<{ price: unknown }>>();
  for (const job of completedJobs) {
    const list = byCustomer.get(job.customerId) ?? [];
    list.push({ price: job.price });
    byCustomer.set(job.customerId, list);
  }
  let repeatRevenue = 0;
  let repeatCustomersCount = 0;
  for (const jobs of Array.from(byCustomer.values())) {
    if (jobs.length > 1) {
      repeatCustomersCount += 1;
      repeatRevenue += jobs.slice(1).reduce((sum: number, j: { price: unknown }) => sum + Number(j.price), 0);
    }
  }

  return { sentCount, openRate, clickRate, repliesCount, conversionsCount, repeatRevenue, repeatCustomersCount };
}

// ---------------------------------------------------------------------------
// AI marketing writer — always saved as a draft Campaign for human approval
// ---------------------------------------------------------------------------

export type CampaignListItem = {
  id: string;
  name: string;
  channel: string;
  tone: string | null;
  aiGenerated: boolean;
  content: string;
  createdAt: Date;
};

export async function listCampaigns(): Promise<CampaignListItem[]> {
  const rows = await db.campaign.findMany({ where: { organisationId: ORG_ID }, orderBy: { createdAt: "desc" } });
  return rows as CampaignListItem[];
}

const SAMPLE_MERGE_FIELDS: Record<string, string> = {
  firstName: "Sarah",
  jobType: "bathroom reseal",
  product: "Dow 785+ Bacteria Resistant",
  colour: "Jasmine White",
  monthsAgo: "12",
  completedDate: "14 March 2025",
  property: "14 Bramble Close, WN1 2AB",
  technician: "Danny",
  bookLink: `${appUrl()}/book/abc123`,
};

export async function generateCampaignCopy(input: GenerateCampaignInput): Promise<{ id: string; content: string }> {
  if (!isAiConfigured()) throw new Error("AI_API_KEY is not set — add it to enable the AI writer.");

  const provider = getAiProvider();
  const content = await provider.generateMarketingCopy({
    tone: marketingToneLabels[input.tone],
    channel: marketingChannelLabels[input.channel],
    channelRule: marketingChannelRules[input.channel],
    brief: input.brief,
    sampleMergeFields: SAMPLE_MERGE_FIELDS,
  });

  const campaign = await db.campaign.create({
    data: {
      organisationId: ORG_ID,
      name: input.name?.trim() || `${marketingToneLabels[input.tone]} ${marketingChannelLabels[input.channel]} draft`,
      channel: input.channel,
      content,
      tone: input.tone,
      aiGenerated: true,
    },
    select: { id: true },
  });

  return { id: campaign.id, content };
}

// ---------------------------------------------------------------------------
// Daily send — called by the CRON_SECRET-protected route and the manual
// "Run reminders now" dashboard button.
// ---------------------------------------------------------------------------

const BATCH_SIZE = 25;

export type RunRemindersResult = { processed: number; sent: number; cancelled: number; skipped: number };

export async function runDueReminders(): Promise<RunRemindersResult> {
  const now = new Date();
  const due = await db.marketingReminder.findMany({
    where: { organisationId: ORG_ID, status: "SCHEDULED", dueDate: { lte: now } },
    include: {
      customer: true,
      job: {
        include: {
          property: true,
          technician: { select: { name: true } },
          materials: { include: { product: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: BATCH_SIZE,
  });

  let sent = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const reminder of due) {
    if (reminder.customer.deletedAt) {
      await db.marketingReminder.update({ where: { id: reminder.id }, data: { status: "CANCELLED" } });
      cancelled++;
      continue;
    }

    // A newer job already exists at the same property — a follow-up is
    // already in motion, so this stale reminder should not fire.
    if (reminder.job.propertyId) {
      const anchor = reminder.job.actualEnd ?? reminder.createdAt;
      const newerJob = await db.job.findFirst({
        where: {
          propertyId: reminder.job.propertyId,
          id: { not: reminder.jobId },
          OR: [{ actualEnd: { gt: anchor } }, { scheduledStart: { gt: anchor } }, { createdAt: { gt: anchor } }],
        },
        select: { id: true },
      });
      if (newerJob) {
        await db.marketingReminder.update({ where: { id: reminder.id }, data: { status: "CANCELLED" } });
        cancelled++;
        continue;
      }
    }

    const sendableChannels = reminder.channels.filter((c) =>
      c === "EMAIL"
        ? reminder.customer.marketingEmail && Boolean(reminder.customer.email)
        : c === "SMS"
          ? reminder.customer.marketingSms && Boolean(reminder.customer.phone)
          : false
    );
    if (sendableChannels.length === 0) {
      // Consent revoked (or never usable) for every intended channel — this
      // reminder can never be sent, so stop it retrying forever.
      await db.marketingReminder.update({ where: { id: reminder.id }, data: { status: "CANCELLED" } });
      cancelled++;
      continue;
    }

    const token = await getOrCreateMarketingToken(reminder.customerId);
    const bookLink = `${appUrl()}/book/${token}?r=${reminder.id}`;
    const unsubscribeUrl = `${appUrl()}/unsubscribe/${token}`;
    const merge = buildMergeData(reminder, bookLink);

    let anySent = false;
    let messageId: string | null = null;

    if (sendableChannels.includes("EMAIL") && isEmailConfigured()) {
      try {
        const subject = renderMergeFields(DEFAULT_REMINDER_SUBJECT, merge);
        const bodyText = renderMergeFields(DEFAULT_REMINDER_EMAIL_BODY, merge);
        const html = wrapEmailHtml({ bodyText, bookLink, unsubscribeUrl });
        const result = await sendMarketingEmail({ to: reminder.customer.email!, subject, html });
        messageId = result.messageId;
        anySent = true;
        await db.communicationLog.create({
          data: { customerId: reminder.customerId, direction: "OUTBOUND", channel: "EMAIL", subject, body: bodyText },
        });
      } catch (err) {
        console.error("Marketing email send failed", err);
      }
    }

    if (sendableChannels.includes("SMS") && isSmsConfigured()) {
      try {
        const smsBody = renderMergeFields(DEFAULT_REMINDER_SMS_BODY, merge);
        const result = await sendSms({ to: reminder.customer.phone!, body: smsBody, statusCallbackUrl: `${appUrl()}/api/webhooks/twilio` });
        messageId = messageId ?? result.messageId;
        anySent = true;
        await db.communicationLog.create({
          data: { customerId: reminder.customerId, direction: "OUTBOUND", channel: "SMS", body: smsBody },
        });
      } catch (err) {
        console.error("Marketing SMS send failed", err);
      }
    }

    if (anySent) {
      await db.marketingReminder.update({ where: { id: reminder.id }, data: { status: "SENT", sentAt: new Date(), messageId } });
      sent++;
    } else {
      // No provider configured for any sendable channel (or the attempt
      // failed) — leave it SCHEDULED so it's retried once messaging is set
      // up, per the graceful no-op rule; never crash the cron.
      skipped++;
    }
  }

  return { processed: due.length, sent, cancelled, skipped };
}

// ---------------------------------------------------------------------------
// Unsubscribe / re-subscribe (public, token-based, no login)
// ---------------------------------------------------------------------------

const ACTIVE_REMINDER_STATUSES = ["SCHEDULED", "SENT", "OPENED", "CLICKED"] as const;

export async function unsubscribeEmailByToken(token: string): Promise<{ ok: boolean; customerName?: string; alreadyUnsubscribed?: boolean }> {
  const customer = await resolveMarketingToken(token);
  if (!customer) return { ok: false };

  const alreadyUnsubscribed = !customer.marketingEmail;
  if (!alreadyUnsubscribed) {
    await db.customer.update({ where: { id: customer.id }, data: { marketingEmail: false } });
    await db.marketingReminder.updateMany({
      where: { customerId: customer.id, status: { in: [...ACTIVE_REMINDER_STATUSES] } },
      data: { status: "UNSUBSCRIBED" },
    });
    await db.communicationLog.create({
      data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", body: "Customer unsubscribed from marketing emails via the unsubscribe link." },
    });
  }
  return { ok: true, customerName: customer.name, alreadyUnsubscribed };
}

export async function setSmsConsentByToken(token: string, subscribed: boolean): Promise<{ ok: boolean }> {
  const customer = await resolveMarketingToken(token);
  if (!customer) return { ok: false };

  await db.customer.update({ where: { id: customer.id }, data: { marketingSms: subscribed, ...(subscribed ? { consentAt: new Date() } : {}) } });
  if (!subscribed) {
    await db.marketingReminder.updateMany({
      where: { customerId: customer.id, status: { in: [...ACTIVE_REMINDER_STATUSES] } },
      data: { status: "UNSUBSCRIBED" },
    });
  }
  await db.communicationLog.create({
    data: {
      customerId: customer.id,
      direction: "INBOUND",
      channel: "SMS",
      body: subscribed ? "Customer re-subscribed to SMS marketing via the unsubscribe page." : "Customer opted out of SMS marketing via the unsubscribe page.",
    },
  });
  return { ok: true };
}

export async function resubscribeEmailByToken(token: string): Promise<{ ok: boolean }> {
  const customer = await resolveMarketingToken(token);
  if (!customer) return { ok: false };

  await db.customer.update({ where: { id: customer.id }, data: { marketingEmail: true, consentAt: new Date() } });
  await db.communicationLog.create({
    data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", body: "Customer re-subscribed to marketing emails via the unsubscribe page." },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rebooking — the page a reminder's book link lands on
// ---------------------------------------------------------------------------

export async function createRebookingEnquiry(customerId: string, data: RebookingRequestInput): Promise<{ enquiryId: string }> {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
  const property = await db.property.findFirstOrThrow({ where: { id: data.propertyId, customerId } });

  const kanbanOrder = await db.enquiry.count({ where: { organisationId: ORG_ID, stage: "NEW" } });
  const enquiry = await db.enquiry.create({
    data: {
      organisationId: ORG_ID,
      customerId,
      propertyId: property.id,
      name: customer.name,
      company: customer.company,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      addressText: property.addressLine1,
      postcode: property.postcode,
      propertyType: property.propertyType,
      workTypes: data.workTypes,
      description: data.description,
      preferredContact: "PHONE",
      consentGiven: true,
      stage: "NEW",
      kanbanOrder,
    },
    select: { id: true },
  });

  await db.timelineEvent.create({
    data: { customerId, type: "ENQUIRY_CREATED", title: "Repeat-business enquiry submitted via a marketing reminder" },
  });

  if (data.reminderId) {
    await db.marketingReminder.updateMany({ where: { id: data.reminderId, customerId }, data: { status: "CONVERTED" } });
  }

  return { enquiryId: enquiry.id };
}

// ---------------------------------------------------------------------------
// Webhook helpers — Resend (email) and Twilio (SMS)
// ---------------------------------------------------------------------------

export async function markReminderStatusByMessageId(messageId: string, status: ReminderStatus, onlyIfCurrentIn?: ReminderStatus[]): Promise<void> {
  const reminder = await db.marketingReminder.findFirst({ where: { messageId } });
  if (!reminder) return;
  if (onlyIfCurrentIn && !onlyIfCurrentIn.includes(reminder.status)) return;
  await db.marketingReminder.update({ where: { id: reminder.id }, data: { status } });
}

export async function handleEmailComplaint(messageId: string): Promise<void> {
  const reminder = await db.marketingReminder.findFirst({ where: { messageId } });
  if (!reminder) return;
  await db.customer.update({ where: { id: reminder.customerId }, data: { marketingEmail: false } });
  await db.marketingReminder.update({ where: { id: reminder.id }, data: { status: "UNSUBSCRIBED" } });
  await db.communicationLog.create({
    data: { customerId: reminder.customerId, direction: "INBOUND", channel: "EMAIL", body: "Customer marked this email as spam — unsubscribed from marketing emails." },
  });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

async function findCustomerByPhone(phone: string): Promise<{ id: string } | null> {
  const target = normalizePhone(phone);
  if (!target) return null;
  const candidates = await db.customer.findMany({
    where: { organisationId: ORG_ID, phone: { not: null } },
    select: { id: true, phone: true },
  });
  const match = candidates.find((c) => c.phone && normalizePhone(c.phone) === target);
  return match ? { id: match.id } : null;
}

const SMS_STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const SMS_START_KEYWORDS = ["START", "YES", "UNSTOP"];

export async function handleInboundSms(fromPhone: string, body: string): Promise<{ handled: boolean }> {
  const customer = await findCustomerByPhone(fromPhone);
  if (!customer) return { handled: false };

  const text = body.trim().toUpperCase();
  await db.communicationLog.create({ data: { customerId: customer.id, direction: "INBOUND", channel: "SMS", body } });

  if (SMS_STOP_KEYWORDS.includes(text)) {
    await db.customer.update({ where: { id: customer.id }, data: { marketingSms: false } });
    await db.marketingReminder.updateMany({
      where: { customerId: customer.id, status: { in: [...ACTIVE_REMINDER_STATUSES] } },
      data: { status: "UNSUBSCRIBED" },
    });
    return { handled: true };
  }

  if (SMS_START_KEYWORDS.includes(text)) {
    await db.customer.update({ where: { id: customer.id }, data: { marketingSms: true, consentAt: new Date() } });
    return { handled: true };
  }

  const recent = await db.marketingReminder.findFirst({
    where: { customerId: customer.id, status: { in: ["SENT", "OPENED", "CLICKED"] } },
    orderBy: { sentAt: "desc" },
  });
  if (recent) {
    await db.marketingReminder.update({ where: { id: recent.id }, data: { status: "REPLIED" } });
  }
  return { handled: true };
}

export async function handleSmsStatusCallback(messageSid: string, messageStatus: string): Promise<void> {
  if (!["failed", "undelivered"].includes(messageStatus)) return;
  const reminder = await db.marketingReminder.findFirst({ where: { messageId: messageSid } });
  if (!reminder) return;
  await db.marketingReminder.update({ where: { id: reminder.id }, data: { status: "FAILED" } });
}
