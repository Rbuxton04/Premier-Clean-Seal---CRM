import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { CustomerInput, PropertyInput } from "@/validators/customer";

export async function listCustomers(query?: string, tagIds?: string[]) {
  return db.customer.findMany({
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
      _count: { select: { properties: true, jobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomer(id: string) {
  return db.customer.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      properties: { orderBy: { createdAt: "asc" } },
      tags: { orderBy: { name: "asc" } },
      timeline: { orderBy: { createdAt: "desc" }, take: 50 },
      communications: { orderBy: { createdAt: "desc" }, take: 50 },
      jobs: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { jobs: true, quotes: true, enquiries: true } },
    },
  });
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

export async function softDeleteCustomer(id: string) {
  return db.customer.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function addProperty(customerId: string, data: PropertyInput) {
  const property = await db.property.create({ data: { customerId, ...data, addressLine2: data.addressLine2 || null, city: data.city || null, notes: data.notes || null } });
  await db.timelineEvent.create({
    data: { customerId, type: "PROPERTY_ADDED", title: `Property added: ${data.addressLine1}, ${data.postcode}` },
  });
  return property;
}

export async function deleteProperty(id: string) {
  return db.property.delete({ where: { id } });
}
