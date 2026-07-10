import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { CustomerInput, PropertyInput } from "@/validators/customer";

// Hand-written detail type so the included relations (esp. tags) are always
// present in the signature, independent of Prisma's include inference across
// the function boundary — which can otherwise collapse to the base model.
export type CustomerWithDetail = {
  id: string;
  organisationId: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  marketingEmail: boolean;
  marketingSms: boolean;
  consentAt: Date | null;
  totalSpend: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  anonymisedAt: Date | null;
  properties: Array<{
    id: string; addressLine1: string; addressLine2: string | null;
    city: string | null; postcode: string; propertyType: string; notes: string | null;
    workLogEntries: Array<{
      id: string; description: string; productId: string | null; productText: string;
      colour: string; area: string | null; batchNumber: string | null; completedAt: Date;
      photos: Array<{ id: string; url: string; thumbnailUrl: string | null }>;
    }>;
  }>;
  tags: Array<{ id: string; name: string; colour: string }>;
  timeline: Array<{ id: string; type: string; title: string; createdAt: Date }>;
  communications: Array<{ id: string; direction: string; body: string; createdAt: Date }>;
  jobs: Array<{ id: string; jobNumber: string; status: string; createdAt: Date }>;
  _count: { jobs: number; quotes: number; enquiries: number };
};

export type CustomerListItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  totalSpend: unknown;
  marketingEmail: boolean;
  marketingSms: boolean;
  tags: Array<{ id: string; name: string; colour: string }>;
  _count: { properties: number; jobs: number };
};

export async function listCustomers(query?: string, tagIds?: string[]): Promise<CustomerListItem[]> {
  const rows = await db.customer.findMany({
    where: {
      organisationId: ORG_ID,
      deletedAt: null,
      ...(tagIds && tagIds.length > 0 ? { tags: { some: { id: { in: tagIds } } } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { company: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { tags: { some: { name: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      tags: true,
      _count: { select: { properties: { where: { deletedAt: null } }, jobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows as CustomerListItem[];
}

export async function getCustomer(id: string): Promise<CustomerWithDetail | null> {
  const customer = await db.customer.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      properties: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { workLogEntries: { orderBy: { completedAt: "desc" }, include: { photos: true } } },
      },
      tags: { orderBy: { name: "asc" } },
      timeline: { orderBy: { createdAt: "desc" }, take: 50 },
      communications: { orderBy: { createdAt: "desc" }, take: 50 },
      jobs: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { jobs: true, quotes: true, enquiries: true } },
    },
  });
  return customer as CustomerWithDetail | null;
}

export async function createCustomer(data: CustomerInput) {
  const customer = await db.customer.create({
    data: {
      organisationId: ORG_ID,
      name: data.name,
      company: data.company || null,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      marketingEmail: data.marketingEmail,
      marketingSms: data.marketingSms,
      consentAt: data.marketingEmail || data.marketingSms ? new Date() : null,
    },
  });
  await db.timelineEvent.create({
    data: { customerId: customer.id, type: "CUSTOMER_CREATED", title: "Customer record created" },
  });
  return customer;
}

export async function updateCustomer(id: string, data: CustomerInput) {
  return db.customer.update({
    where: { id },
    data: {
      name: data.name,
      company: data.company || null,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      marketingEmail: data.marketingEmail,
      marketingSms: data.marketingSms,
    },
  });
}

/**
 * Soft-delete: hides the customer everywhere (every deletedAt: null query
 * above, plus the job/quote/invoice/calendar/map/search/gallery queries that
 * filter on customer.deletedAt) without touching their properties, jobs,
 * quotes, invoices, or warranties, none of which cascade. Any still-scheduled
 * marketing reminder is cancelled immediately, rather than waiting for the
 * daily send job to discover the customer is gone, so a deleted customer can
 * never be marketed to in the meantime. Callers are responsible for the
 * admin-only check; this function trusts its caller, same convention as
 * JobService.softDeleteJob.
 */
export async function softDeleteCustomer(id: string, userId: string | null): Promise<void> {
  await db.customer.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
  await db.marketingReminder.updateMany({ where: { customerId: id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
  const actor = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await db.timelineEvent.create({
    data: { customerId: id, type: "CUSTOMER_DELETED", title: `Customer deleted${actor ? ` by ${actor.name}` : ""}` },
  });
}

export async function restoreCustomer(id: string): Promise<void> {
  await db.customer.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await db.timelineEvent.create({ data: { customerId: id, type: "CUSTOMER_RESTORED", title: "Customer restored" } });
}

/** Consent centre toggle — opt-out takes effect immediately (no confirmation delay). */
export async function setMarketingConsent(id: string, marketingEmail: boolean, marketingSms: boolean) {
  return db.customer.update({
    where: { id },
    data: { marketingEmail, marketingSms, consentAt: marketingEmail || marketingSms ? new Date() : null },
  });
}

export async function addProperty(customerId: string, data: PropertyInput) {
  const property = await db.property.create({ data: { customerId, ...data, addressLine2: data.addressLine2 || null, city: data.city || null, notes: data.notes || null } });
  await db.timelineEvent.create({
    data: { customerId, type: "PROPERTY_ADDED", title: `Property added: ${data.addressLine1}, ${data.postcode}` },
  });
  return property;
}

/**
 * Soft-delete: hides the property everywhere (it stops matching every
 * deletedAt: null query above) without touching its work-log entries,
 * materials history, or any job/enquiry that references it — none of which
 * cascade. Callers are responsible for the admin-only check; this function
 * trusts its caller, same convention as JobService.softDeleteJob.
 */
export async function softDeleteProperty(id: string, userId: string | null): Promise<void> {
  const property = await db.property.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: userId },
  });
  const actor = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await db.timelineEvent.create({
    data: {
      customerId: property.customerId,
      type: "PROPERTY_DELETED",
      title: `Property deleted: ${property.addressLine1}, ${property.postcode}${actor ? ` by ${actor.name}` : ""}`,
    },
  });
}

export async function restoreProperty(id: string): Promise<void> {
  const property = await db.property.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await db.timelineEvent.create({
    data: { customerId: property.customerId, type: "PROPERTY_RESTORED", title: `Property restored: ${property.addressLine1}, ${property.postcode}` },
  });
}
