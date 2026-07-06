"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { ReminderListItem } from "@/services/marketing.service";
import { cancelReminderAction, rescheduleReminderAction } from "./actions";

function dueInLabel(dueDate: Date | string): string {
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `in ${days}d`;
}

function ReminderRow({ reminder }: { reminder: ReminderListItem }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState(new Date(reminder.dueDate).toISOString().slice(0, 10));

  return (
    <TableRow>
      <TableCell>{reminder.customer.name}</TableCell>
      <TableCell>
        {reminder.job.jobNumber}
        {reminder.job.materials[0]?.product.colour ? ` — ${reminder.job.materials[0].product.colour}` : ""}
      </TableCell>
      <TableCell>{reminder.intervalMonths}mo</TableCell>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-36" />
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await rescheduleReminderAction(reminder.id, dueDate);
                  setEditing(false);
                })
              }
            >
              Save
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-left hover:underline">
            {dueInLabel(reminder.dueDate)}
          </button>
        )}
      </TableCell>
      <TableCell>{reminder.channels.join(", ") || "—"}</TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(() => cancelReminderAction(reminder.id))}>
          Cancel
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function RemindersTable({ reminders }: { reminders: ReminderListItem[] }) {
  if (reminders.length === 0) return <p className="text-sm text-muted-foreground">No reminders scheduled.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Job / colour</TableHead>
          <TableHead>Interval</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Channels</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {reminders.map((r) => (
          <ReminderRow key={r.id} reminder={r} />
        ))}
      </TableBody>
    </Table>
  );
}
