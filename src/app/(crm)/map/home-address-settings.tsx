"use client";

import { useState } from "react";
import { Home, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setTechnicianHomeAddressAction } from "./actions";

export function HomeAddressSettings({
  technicianId,
  homeAddress,
  onSaved,
}: {
  technicianId: string;
  homeAddress: string | null;
  onSaved: (address: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(homeAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await setTechnicianHomeAddressAction({ technicianId, address: value.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(result.address ?? null);
    setEditing(false);
  }

  function cancel() {
    setValue(homeAddress ?? "");
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-muted-foreground">{homeAddress || "No home address saved"}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">Home / end address</p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 12 Elm Street, Leigh, WN7 1AB"
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
