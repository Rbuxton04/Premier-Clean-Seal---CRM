"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ALLOWED_TUBE_ML, type MaterialDefaultsValues } from "@/validators/takeoff";
import { updateMaterialDefaultsAction } from "./actions";

/**
 * Worst-case materials defaults (Drawings Part 2, section 6) -- org-wide,
 * Admin/Office only. Affects only the materials (tubes-to-buy) list on a
 * drawing, never the customer's quote.
 */
export function MaterialDefaultsSection({ defaults, canManage }: { defaults: MaterialDefaultsValues; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await updateMaterialDefaultsAction(values);
    setSaving(false);
    setMessage(result.ok ? "Saved." : result.message);
    if (result.ok) setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className="rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-1.5 p-3 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Materials defaults
      </button>
      {open && (
        <div className="space-y-3 border-t p-3">
          <p className="text-xs text-muted-foreground">
            Used for the worst-case materials list (tubes to buy) on every drawing -- always rounded up, never the
            quoted amount, which stays on measured metres.
          </p>
          {!canManage && <p className="text-xs text-muted-foreground">View only -- ask an admin or office user to make changes.</p>}
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-xs text-muted-foreground">
              Joint width (mm)
              <Input
                type="number" min="1" disabled={!canManage}
                value={values.jointWidthMm}
                onChange={(e) => setValues((v) => ({ ...v, jointWidthMm: Number(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Joint depth (mm)
              <Input
                type="number" min="1" disabled={!canManage}
                value={values.jointDepthMm}
                onChange={(e) => setValues((v) => ({ ...v, jointDepthMm: Number(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Tube size
              <Select
                disabled={!canManage}
                value={values.tubeMl}
                onChange={(e) => setValues((v) => ({ ...v, tubeMl: Number(e.target.value) }))}
                className="h-8 text-sm"
              >
                {ALLOWED_TUBE_ML.map((ml) => <option key={ml} value={ml}>{ml} ml</option>)}
              </Select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Waste %
              <Input
                type="number" min="0" step="1" disabled={!canManage}
                value={values.wastePercent}
                onChange={(e) => setValues((v) => ({ ...v, wastePercent: Number(e.target.value) || 0 }))}
                className="h-8 text-sm"
              />
            </label>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
              {message && <span className="text-xs text-muted-foreground">{message}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
