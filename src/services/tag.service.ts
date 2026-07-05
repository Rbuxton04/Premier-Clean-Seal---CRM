import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";

export type TagListItem = { id: string; name: string; colour: string; _count: { customers: number } };

export async function listTags(): Promise<TagListItem[]> {
  const rows = await db.tag.findMany({
    where: { organisationId: ORG_ID },
    include: { _count: { select: { customers: true } } },
    orderBy: { name: "asc" },
  });
  return rows as TagListItem[];
}

export async function createTag(name: string, colour: string) {
  return db.tag.create({ data: { organisationId: ORG_ID, name: name.trim(), colour } });
}

export async function updateTag(id: string, name: string, colour: string) {
  return db.tag.update({ where: { id }, data: { name: name.trim(), colour } });
}

export async function deleteTag(id: string) {
  // Removing a tag just unlinks it from customers (many-to-many); no customer is deleted.
  return db.tag.delete({ where: { id } });
}

export async function setCustomerTags(customerId: string, tagIds: string[]) {
  return db.customer.update({
    where: { id: customerId },
    data: { tags: { set: tagIds.map((id) => ({ id })) } },
  });
}
