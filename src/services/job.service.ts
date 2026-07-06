import type { JobStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { nextDocumentNumber } from "@/lib/numbering";
import type { JobFormInput, JobUpdateInput } from "@/validators/job";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type JobListItem = {
  id: string;
  jobNumber: string;
  status: string;
  scheduledStart: Date | null;
  price: unknown;
  paymentStatus: string;
  customer: { id: string; name: string };
  property: { id: string; postcode: string } | null;
  technician: { id: string; name: string } | null;
};

export type JobDetail = {
  id: string;
  organisationId: string;
  jobNumber: string;
  status: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  price: unknown;
  depositPaid: unknown;
  balanceDue: unknown;
  paymentStatus: string;
  notes: string | null;
  internalNotes: string | null;
  completionNotes: string | null;
  metresInstalled: unknown;
  customerSignature: string | null;
  satisfactionRating: number | null;
  customerId: string;
  technicianId: string | null;
  propertyId: string | null;
  quoteId: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  property: { id: string; addressLine1: string; postcode: string } | null;
  technician: { id: string; name: string } | null;
  quote: { id: string; quoteNumber: string } | null;
  materials: Array<{
    id: string;
    batchNumber: string | null;
    applicationArea: string;
    quantityUsed: unknown;
    unit: string;
    cost: unknown;
    product: { manufacturer: string; name: string; colour: string };
  }>;
  files: Array<{ id: string; kind: string; category: string | null; url: string; thumbnailUrl: string | null }>;
  warranty: { id: string; startDate: Date; endDate: Date; coverage: string; certificateUrl: string | null } | null;
  invoice: { id: string; invoiceNumber: string; amount: unknown; status: string; dueDate: Date; pdfUrl: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TechnicianOption = { id: string; name: string };

export type CustomerForJobPicker = {
  id: string;
  name: string;
  company: string | null;
  properties: Array<{ id: string; addressLine1: string; postcode: string }>;
};

export type CalendarJobItem = {
  id: string;
  jobNumber: string;
  status: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  technicianId: string | null;
  price: unknown;
  customer: { id: string; name: string };
  property: { id: string; postcode: string } | null;
};

const jobListInclude = {
  customer: { select: { id: true, name: true } },
  property: { select: { id: true, postcode: true } },
  technician: { select: { id: true, name: true } },
};

export async function listJobs(status?: string, technicianId?: string): Promise<JobListItem[]> {
  const rows = await db.job.findMany({
    where: {
      organisationId: ORG_ID,
      ...(status ? { status: status as JobStatus } : {}),
      ...(technicianId ? { technicianId } : {}),
    },
    include: jobListInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows as JobListItem[];
}

export async function getJob(id: string): Promise<JobDetail | null> {
  const row = await db.job.findFirst({
    where: { id, organisationId: ORG_ID },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      property: { select: { id: true, addressLine1: true, postcode: true } },
      technician: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true } },
      materials: { include: { product: { select: { manufacturer: true, name: true, colour: true } } } },
      files: { select: { id: true, kind: true, category: true, url: true, thumbnailUrl: true }, orderBy: { createdAt: "asc" } },
      warranty: { select: { id: true, startDate: true, endDate: true, coverage: true, certificateUrl: true } },
      invoice: { select: { id: true, invoiceNumber: true, amount: true, status: true, dueDate: true, pdfUrl: true } },
    },
  });
  return row as JobDetail | null;
}

export async function listTechnicians(): Promise<TechnicianOption[]> {
  return db.user.findMany({
    where: { organisationId: ORG_ID, active: true, role: { in: ["TECHNICIAN", "ADMIN"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listCustomersForJobPicker(): Promise<CustomerForJobPicker[]> {
  return db.customer.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: { id: true, name: true, company: true, properties: { select: { id: true, addressLine1: true, postcode: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listCalendarData(
  weekStart: Date,
  weekEnd: Date
): Promise<{ technicians: TechnicianOption[]; scheduled: CalendarJobItem[]; unscheduled: CalendarJobItem[] }> {
  const [technicians, scheduled, unscheduled] = await Promise.all([
    listTechnicians(),
    db.job.findMany({
      where: { organisationId: ORG_ID, scheduledStart: { gte: weekStart, lt: weekEnd } },
      include: jobListInclude,
      orderBy: { scheduledStart: "asc" },
    }),
    db.job.findMany({
      where: { organisationId: ORG_ID, scheduledStart: null, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: jobListInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { technicians, scheduled: scheduled as CalendarJobItem[], unscheduled: unscheduled as CalendarJobItem[] };
}

export async function createJob(data: JobFormInput): Promise<{ id: string }> {
  const jobNumber = await nextDocumentNumber(ORG_ID, "job");
  const price = data.price;
  const depositPaid = data.depositPaid ?? 0;

  const job = await db.job.create({
    data: {
      organisationId: ORG_ID,
      jobNumber,
      customerId: data.customerId,
      propertyId: data.propertyId || null,
      technicianId: data.technicianId || null,
      status: "BOOKED",
      scheduledStart: data.scheduledStart ?? null,
      price,
      depositPaid,
      balanceDue: +(price - depositPaid).toFixed(2),
      paymentStatus: depositPaid > 0 ? "DEPOSIT_PAID" : "UNPAID",
      notes: data.notes || null,
    },
  });

  await db.timelineEvent.create({
    data: { customerId: data.customerId, type: "JOB_CREATED", title: `Job ${jobNumber} created` },
  });

  return { id: job.id };
}

export async function updateJob(id: string, data: JobUpdateInput): Promise<void> {
  const current = await db.job.findUniqueOrThrow({ where: { id } });
  const price = data.price ?? Number(current.price);
  const depositPaid = data.depositPaid ?? Number(current.depositPaid);
  const balanceDue = +(price - depositPaid).toFixed(2);

  await db.job.update({
    where: { id },
    data: {
      status: data.status,
      technicianId: data.technicianId !== undefined ? data.technicianId || null : undefined,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      price,
      depositPaid,
      balanceDue,
      notes: data.notes,
      internalNotes: data.internalNotes,
    },
  });

  const events: string[] = [];
  if (data.status && data.status !== current.status) {
    events.push(`Job ${current.jobNumber} status changed to ${data.status}`);
  }
  if (data.technicianId !== undefined && data.technicianId !== current.technicianId) {
    const tech = data.technicianId ? await db.user.findUnique({ where: { id: data.technicianId }, select: { name: true } }) : null;
    events.push(tech ? `Job ${current.jobNumber} assigned to ${tech.name}` : `Job ${current.jobNumber} unassigned`);
  }
  for (const title of events) {
    await db.timelineEvent.create({ data: { customerId: current.customerId, type: "JOB_UPDATED", title } });
  }
}

/** Drag-and-drop scheduling from the calendar. dateISO null moves the job back to the unscheduled tray. */
export async function scheduleJob(jobId: string, technicianId: string | null, dateISO: string | null): Promise<void> {
  const current = await db.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { quote: { include: { lineItems: true } } },
  });

  if (!dateISO) {
    await db.job.update({ where: { id: jobId }, data: { scheduledStart: null, scheduledEnd: null, technicianId: null } });
    await db.timelineEvent.create({
      data: { customerId: current.customerId, type: "JOB_UNSCHEDULED", title: `Job ${current.jobNumber} moved back to unscheduled` },
    });
    return;
  }

  const start = new Date(dateISO);
  start.setHours(9, 0, 0, 0);
  // Prefer the quote's labour line (hours) for a realistic duration; default to 2 hours.
  const labourLine = current.quote?.lineItems.find((l) => l.unit === "hours");
  const durationHours = labourLine ? Number(labourLine.quantity) : 2;
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  await db.job.update({ where: { id: jobId }, data: { technicianId, scheduledStart: start, scheduledEnd: end } });

  const tech = technicianId ? await db.user.findUnique({ where: { id: technicianId }, select: { name: true } }) : null;
  await db.timelineEvent.create({
    data: {
      customerId: current.customerId,
      type: "JOB_SCHEDULED",
      title: `Job ${current.jobNumber} scheduled for ${start.toLocaleDateString("en-GB")}${tech ? ` with ${tech.name}` : ""}`,
    },
  });
}

export type ConvertToJobResult = { jobId: string; created: boolean };

/** Converts an APPROVED quote into a job. Idempotent — a quote already
 * converted just returns the existing job rather than creating a second one. */
export async function convertQuoteToJob(quoteId: string): Promise<ConvertToJobResult> {
  const quote = await db.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { job: { select: { id: true } }, enquiry: { select: { propertyId: true } } },
  });

  if (quote.job) return { jobId: quote.job.id, created: false };
  if (quote.status !== "APPROVED") throw new Error("Only approved quotes can be converted to a job.");

  const jobNumber = await nextDocumentNumber(ORG_ID, "job");
  const price = Number(quote.total);

  const job = await db.job.create({
    data: {
      organisationId: ORG_ID,
      jobNumber,
      customerId: quote.customerId,
      propertyId: quote.enquiry?.propertyId ?? null,
      quoteId: quote.id,
      status: "BOOKED",
      price,
      // Deposit collection is a Stripe stub (M4) — nothing has actually been
      // received yet, so don't imply payment here.
      depositPaid: 0,
      balanceDue: price,
      paymentStatus: "UNPAID",
    },
  });

  await db.timelineEvent.create({
    data: { customerId: quote.customerId, type: "JOB_CREATED", title: `Job ${jobNumber} created from quote ${quote.quoteNumber}` },
  });

  return { jobId: job.id, created: true };
}
