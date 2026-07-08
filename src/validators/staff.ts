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

export const updateUserRoleSchema = z.object({
  role: z.enum(roles),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
