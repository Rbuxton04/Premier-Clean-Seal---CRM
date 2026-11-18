"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ScalePresetItem } from "@/services/scale-preset.service";

const CUSTOM_RATIO = "custom";

export function ScaleControls({
  scaleRatioLabel,
  presets,
  calibrating,
  onApplyRatio,
  onStartCalibration,
  onCancelCalibration,
  onSaveCustomPreset,
}: {
  scaleRatioLabel: string | null;
  presets: ScalePresetItem[];
  calibrating: boolean;
  onApplyRatio: (ratio: number, label: string | null) => void;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onSaveCustomPreset: (label: string, ratio: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<string>(presets[0]?.id ?? CUSTOM_RATIO);
  const [customRatio, setCustomRatio] = useState("50");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState("");

  function apply() {
    const selected = presets.find((p) => p.id === presetId);
    const ratio = selected ? selected.ratio : Number(customRatio);
    if (!ratio || ratio <= 0) return;
    const label = selected ? selected.label : `1:${ratio}`;
    onApplyRatio(ratio, label);
    if (!selected && saveAsPreset && newPresetLabel.trim()) {
      onSaveCustomPreset(newPresetLabel.trim(), ratio);
    }
    setOpen(false);
  }

  if (calibrating) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-plum bg-brand-plum-soft p-2.5 text-sm">
        <span>Click two points on the plan over a feature of known length (e.g. a door), then enter its real length.</span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelCalibration}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-sm">
      <span className="text-muted-foreground">Scale:</span>
      <span className="font-medium">{scaleRatioLabel ?? "Calibrated"}</span>
      {!open ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Change</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onStartCalibration}>Calibrate with a line…</Button>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="h-8 w-auto text-xs">
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value={CUSTOM_RATIO}>Custom…</option>
          </Select>
          {presetId === CUSTOM_RATIO && (
            <>
              <span className="text-xs">1 :</span>
              <Input type="number" min="1" value={customRatio} onChange={(e) => setCustomRatio(e.target.value)} className="h-8 w-20 text-xs" />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={saveAsPreset} onChange={(e) => setSaveAsPreset(e.target.checked)} /> Save as preset
              </label>
              {saveAsPreset && (
                <Input placeholder="Label, e.g. 1:75" value={newPresetLabel} onChange={(e) => setNewPresetLabel(e.target.value)} className="h-8 w-28 text-xs" />
              )}
            </>
          )}
          <Button type="button" size="sm" onClick={apply}>Apply</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
