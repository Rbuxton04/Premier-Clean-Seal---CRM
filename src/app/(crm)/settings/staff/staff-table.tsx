"use client";

import { useTransition } from "react";
import { useFormState } from "react-dom";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { roles, roleLabels } from "@/validators/staff";
import { updateUserRoleAction, setUserActiveAction, type StaffFormState } from "./actions";
import type { StaffListItem } from "@/services/user.service";

function RoleCell({ member }: { member: StaffListItem }) {
  const action = updateUserRoleAction.bind(null, member.id);
  const [state, formAction] = useFormState<StaffFormState, FormData>(action, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="role" defaultValue={member.role} className="h-8 w-36">
        {roles.map((r) => (
          <option key={r} value={r}>{roleLabels[r]}</option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline">Save</Button>
      {state && !state.ok && <span className="text-xs text-destructive">{state.message}</span>}
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
          <TableHead>Role</TableHead>
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
