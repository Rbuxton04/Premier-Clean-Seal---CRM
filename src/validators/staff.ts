import { z } from "zod";

export const roles = ["ADMIN", "OFFICE", "ESTIMATOR", "TECHNICIAN", "SALES", "READONLY", "ACCOUNTANT"] as const;

export const roleLabels: Record<(typeof roles)[number], string> = {
  ADMIN: "Admin",
  OFFICE: "Office",
  ESTIMATOR: "Estimator",
  TECHNICIAN: "Technician",
  SALES: "Sales",
  READONLY: "Read only",
  ACCOUNTANT: "Accountant",
};

export const updateUserRolesSchema = z.object({
  roles: z.array(z.enum(roles)).min(1, "Pick at least one role."),
});
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
