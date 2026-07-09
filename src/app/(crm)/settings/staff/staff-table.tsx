"use client";

import { useTransition } from "react";
import { useFormState } from "react-dom";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { roles, roleLabels } from "@/validators/staff";
import { updateUserRolesAction, setUserActiveAction, type StaffFormState } from "./actions";
import type { StaffListItem } from "@/services/user.service";

// Multi-select: a user can hold several roles at once (e.g. an owner who is
// both Admin and Technician) — capabilities are additive, most-permissive
// wins, see src/lib/permissions.ts.
function RoleCell({ member }: { member: StaffListItem }) {
  const action = updateUserRolesAction.bind(null, member.id);
  const [state, formAction] = useFormState<StaffFormState, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {roles.map((r) => (
          <label key={r} className="flex items-center gap-1.5 text-xs">
            <Checkbox name="roles" value={r} defaultChecked={member.roles.includes(r)} />
            {roleLabels[r]}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="outline">Save</Button>
        {state && !state.ok && <span className="text-xs text-destructive">{state.message}</span>}
      </div>
    </form>
  );
}

export function StaffTable({ staff, currentUserId }: { staff: StaffListItem[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">
              {m.name} {m.id === currentUserId && <span className="text-xs text-muted-foreground">(you)</span>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
            <TableCell><RoleCell member={m} /></TableCell>
            <TableCell>
              <Badge variant={m.active ? "success" : "warning"}>{m.active ? "Active" : "Deactivated"}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{new Date(m.createdAt).toLocaleDateString("en-GB")}</TableCell>
            <TableCell>
              {m.id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(() => setUserActiveAction(m.id, !m.active))}
                >
                  {m.active ? "Deactivate" : "Reactivate"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
