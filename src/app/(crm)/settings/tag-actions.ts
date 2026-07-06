"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as TagService from "@/services/tag.service";
import { writeAudit, actorContext } from "@/lib/audit";

const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(40),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
});

export type TagFormState = { ok: boolean; message: string } | null;

export async function createTagAction(_prev: TagFormState, formData: FormData): Promise<TagFormState> {
  const parsed = tagSchema.safeParse({ name: formData.get("name"), colour: formData.get("colour") });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid tag." };
  let created: { id: string };
  try {
    created = await TagService.createTag(parsed.data.name, parsed.data.colour);
  } catch {
    return { ok: false, message: "That tag already exists." };
  }
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "tag", resourceId: created.id, after: parsed.data, ip });
  revalidatePath("/settings/tags");
  revalidatePath("/customers");
  return { ok: true, message: "Tag added" };
}

export async function updateTagAction(id: string, formData: FormData): Promise<void> {
  const parsed = tagSchema.safeParse({ name: formData.get("name"), colour: formData.get("colour") });
  if (!parsed.success) return;
  await TagService.updateTag(id, parsed.data.name, parsed.data.colour);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "tag", resourceId: id, after: parsed.data, ip });
  revalidatePath("/settings/tags");
  revalidatePath("/customers");
}

export async function deleteTagAction(id: string): Promise<void> {
  await TagService.deleteTag(id);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "DELETE", resource: "tag", resourceId: id, ip });
  revalidatePath("/settings/tags");
  revalidatePath("/customers");
}
