"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { updateUserRoleSchema } from "@/validators/staff";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { getUser, updateUserRole, setUserActive } from "@/services/user.service";

export type StaffFormState = { ok: boolean; message: string } | null;

export async function updateUserRoleAction(userId: string, _prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const parsed = updateUserRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Pick a valid role." };

  try {
    const actor = await requireAdmin();
    const before = await getUser(userId);
    if (!before) return { ok: false, message: "Staff member not found." };

    await updateUserRole(userId, parsed.data.role);
    await writeAudit({
      userId: actor.id,
      action: "UPDATE",
      resource: "user.role",
      resourceId: userId,
      before: { role: before.role },
      after: { role: parsed.data.role },
      ip: headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    revalidatePath("/settings/staff");
    return { ok: true, message: "Role updated." };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<void> {
  const actor = await requireAdmin();
  const before = await getUser(userId);
  if (!before) return;

  await setUserActive(userId, active);
  await writeAudit({
    userId: actor.id,
    action: active ? "ACTIVATE" : "DEACTIVATE",
    resource: "user.active",
    resourceId: userId,
    before: { active: before.active },
    after: { active },
    ip: headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  revalidatePath("/settings/staff");
}
