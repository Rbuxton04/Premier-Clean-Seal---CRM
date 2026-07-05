import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { enquiryStageLabels, enquiryStages, type EnquiryFieldsInput, type PublicEnquiryInput } from "@/validators/enquiry";
import type { propertyTypes } from "@/validators/customer";

// Explicit hand-written return types so included relations survive across
// the function boundary (see the Prisma typing note in customer.service.ts).
export type EnquiryCardItem = {
  id: string;
  name: string;
  company: string | null;
  postcode: string;
  stage: string;
  priority: string;
  kanbanOrder: number;
  estimatedValue: unknown;
  createdAt: Date;
  assignedTo: { id: string; name: string } | null;
  files: Array<{ id: string; url: string; thumbnailUrl: string | null; kind: string }>;
};

export type EnquiryDetail = {
  id: string;
  organisationId: string;
  customerId: string | null;
  propertyId: string | null;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  addressText: string;
  postcode: string;
  propertyType: string;
  workTypes: string[];
  description: string;
  preferredContact: string;
  preferredDate: Date | null;
  consentGiven: boolean;
  stage: string;
  priority: string;
  kanbanOrder: number;
  estimatedValue: unknown;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  files: Array<{ id: string; url: string; thumbnailUrl: string | null; kind: string; mimeType: string }>;
  aiAnalysis: {
    id: string;
    findings: unknown;
    jobSummary: string;
    estimatedWork: string;
    estimatedMetres: unknown;
    suggestedProducts: unknown;
    suggestedColours: string[];
    suggestedLabourHrs: unknown;
    quoteNotes: string | null;
    confidence: number;
    model: string;
    editedByUser: boolean;
    createdAt: Date;
  } | null;
  customer: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerMatch = { id: string; name: string; email: string | null; phone: string | null; company: string | null };
export type AssigneeOption = { id: string; name: string };

export async function listEnquiries(): Promise<EnquiryCardItem[]> {
  const rows = await db.enquiry.findMany({
    where: { organisationId: ORG_ID },
    include: {
      assignedTo: { select: { id: true, name: true } },
      files: { select: { id: true, url: true, thumbnailUrl: true, kind: true }, take: 4 },
    },
    orderBy: { kanbanOrder: "asc" },
  });
  return rows as EnquiryCardItem[];
}

export async function getEnquiry(id: string): Promise<EnquiryDetail | null> {
  const row = await db.enquiry.findFirst({
    where: { id, organisationId: ORG_ID },
    include: {
      assignedTo: { select: { id: true, name: true } },
      files: { select: { id: true, url: true, thumbnailUrl: true, kind: true, mimeType: true }, orderBy: { createdAt: "asc" } },
      aiAnalysis: {
        select: {
          id: true,
          findings: true,
          jobSummary: true,
          estimatedWork: true,
          estimatedMetres: true,
          suggestedProducts: true,
          suggestedColours: true,
          suggestedLabourHrs: true,
          quoteNotes: true,
          confidence: true,
          model: true,
          editedByUser: true,
          createdAt: true,
        },
      },
      customer: { select: { id: true, name: true } },
    },
  });
  return row as EnquiryDetail | null;
}

export async function createPublicEnquiry(data: PublicEnquiryInput): Promise<{ id: string }> {
  const kanbanOrder = await db.enquiry.count({ where: { organisationId: ORG_ID, stage: "NEW" } });

  const enquiry = await db.enquiry.create({
    data: {
      organisationId: ORG_ID,
      name: data.name,
      company: data.company || null,
      phone: data.phone,
      email: data.email,
      addressText: data.addressText,
      postcode: data.postcode,
      propertyType: data.propertyType,
      workTypes: data.workTypes,
      description: data.description,
      preferredContact: data.preferredContact,
      preferredDate: data.preferredDate,
      consentGiven: data.consentGiven,
      stage: "NEW",
      kanbanOrder,
      files: {
        create: data.files.map((f) => ({
          organisationId: ORG_ID,
          kind: f.kind,
          url: f.url,
          thumbnailUrl: f.thumbnailUrl,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
        })),
      },
    },
    select: { id: true },
  });

  return enquiry;
}

export async function moveEnquiry(id: string, toStage: (typeof enquiryStages)[number], toIndex: number): Promise<void> {
  const current = await db.enquiry.findUniqueOrThrow({ where: { id }, select: { stage: true, customerId: true } });

  const siblings = await db.enquiry.findMany({
    where: { organisationId: ORG_ID, stage: toStage, NOT: { id } },
    orderBy: { kanbanOrder: "asc" },
    select: { id: true },
  });
  const ids = siblings.map((s) => s.id);
  const clamped = Math.max(0, Math.min(toIndex, ids.length));
  ids.splice(clamped, 0, id);

  await db.$transaction(ids.map((rowId, i) => db.enquiry.update({ where: { id: rowId }, data: { stage: toStage, kanbanOrder: i } })));

  if (current.stage !== toStage && current.customerId) {
    await db.timelineEvent.create({
      data: {
        customerId: current.customerId,
        type: "ENQUIRY_STAGE_CHANGED",
        title: `Enquiry stage changed to ${enquiryStageLabels[toStage]}`,
      },
    });
  }
}

export async function updateEnquiryFields(id: string, data: EnquiryFieldsInput) {
  return db.enquiry.update({
    where: { id },
    data: {
      priority: data.priority,
      assignedToId: data.assignedToId || null,
      estimatedValue: data.estimatedValue,
    },
  });
}

export async function findMatchingCustomers(email: string, phone: string): Promise<CustomerMatch[]> {
  const or: Array<Record<string, unknown>> = [];
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });
  if (phone) or.push({ phone });
  if (or.length === 0) return [];

  const rows = await db.customer.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, OR: or },
    select: { id: true, name: true, email: true, phone: true, company: true },
    take: 5,
  });
  return rows as CustomerMatch[];
}

async function findOrCreateProperty(
  customerId: string,
  addressText: string,
  postcode: string,
  propertyType: (typeof propertyTypes)[number]
) {
  const existing = await db.property.findFirst({
    where: { customerId, postcode: { equals: postcode, mode: "insensitive" } },
  });
  if (existing) return existing;

  const property = await db.property.create({
    data: { customerId, addressLine1: addressText, postcode, propertyType },
  });
  await db.timelineEvent.create({
    data: { customerId, type: "PROPERTY_ADDED", title: `Property added: ${addressText}, ${postcode}` },
  });
  return property;
}

export async function convertToNewCustomer(enquiryId: string): Promise<{ customerId: string }> {
  const enquiry = await db.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });

  const customer = await db.customer.create({
    data: {
      organisationId: ORG_ID,
      name: enquiry.name,
      company: enquiry.company,
      phone: enquiry.phone,
      email: enquiry.email,
    },
  });
  await db.timelineEvent.create({
    data: { customerId: customer.id, type: "CUSTOMER_CREATED", title: "Customer record created (converted from enquiry)" },
  });

  const property = await findOrCreateProperty(customer.id, enquiry.addressText, enquiry.postcode, enquiry.propertyType);

  await db.enquiry.update({ where: { id: enquiryId }, data: { customerId: customer.id, propertyId: property.id } });

  return { customerId: customer.id };
}

export async function convertToExistingCustomer(enquiryId: string, customerId: string): Promise<{ customerId: string }> {
  const enquiry = await db.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });

  const property = await findOrCreateProperty(customerId, enquiry.addressText, enquiry.postcode, enquiry.propertyType);

  await db.enquiry.update({ where: { id: enquiryId }, data: { customerId, propertyId: property.id } });
  await db.timelineEvent.create({
    data: { customerId, type: "ENQUIRY_LINKED", title: `Enquiry linked: ${enquiry.description.slice(0, 80)}` },
  });

  return { customerId };
}

export async function listAssigneeOptions(): Promise<AssigneeOption[]> {
  const rows = await db.user.findMany({
    where: { organisationId: ORG_ID, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}
