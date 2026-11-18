"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ScalePresetItem } from "@/services/scale-preset.service";
import { createTakeoffAction } from "../actions";

type CustomerOption = { id: string; name: string; company: string | null };

const CUSTOM_RATIO = "custom";

export function NewTakeoffForm({
  customers,
  presets,
  storageReady,
  defaultCustomerId,
  jobId,
  quoteId,
}: {
  customers: CustomerOption[];
  presets: ScalePresetItem[];
  storageReady: boolean;
  defaultCustomerId?: string;
  jobId?: string;
  quoteId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [presetId, setPresetId] = useState<string>(presets[0]?.id ?? CUSTOM_RATIO);
  const [customRatio, setCustomRatio] = useState("50");
  const [message, setMessage] = useState<string | null>(null);

  function handleFile(f: File | null) {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.pdf$/i, ""));
  }

  function submit() {
    setMessage(null);
    if (!file) {
      setMessage("Choose a PDF plan to upload.");
      return;
    }
    if (!storageReady) {
      setMessage("Storage isn't connected yet — set the SUPABASE_* storage env vars to enable uploads.");
      return;
    }

    const selectedPreset = presets.find((p) => p.id === presetId);
    const ratio = selectedPreset ? selectedPreset.ratio : Number(customRatio);
    if (!ratio || ratio <= 0) {
      setMessage("Enter a valid scale ratio.");
      return;
    }

    startTransition(async () => {
      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "application/pdf" }),
        });
        const presign = await presignRes.json();
        if (!presign.configured) {
          setMessage("Storage isn't connected yet — set the SUPABASE_* storage env vars to enable uploads.");
          return;
        }
        await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/pdf" }, body: file });

        const result = await createTakeoffAction({
          name: name || file.name,
          pdfFileUrl: presign.path,
          customerId: customerId || undefined,
          jobId,
          quoteId,
          scale: selectedPreset
            ? { ratio: selectedPreset.ratio, label: selectedPreset.label }
            : { ratio },
        });
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.push(`/measure/${result.data.id}`);
      } catch {
        setMessage("Upload failed — please try again.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {!storageReady && (
        <p className="text-xs text-muted-foreground">
          Storage isn&apos;t connected yet, so an uploaded plan won&apos;t be saved — set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_STORAGE_BUCKET to activate this.
        </p>
      )}

      <div className="space-y-1.5">
        <Label>Plan PDF *</Label>
        <label className="flex h-10 w-full cursor-pointer items-center gap-2 truncate rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-accent">
          <Upload className="h-4 w-4 shrink-0" /> <span className="truncate">{file ? file.name : "Choose a PDF plan"}</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hilton Wigan — ground floor" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerId">Company / customer</Label>
        <Select id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Not yet linked — can set this later</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scale</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="presetId">Preset ratio</Label>
            <Select id="presetId" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value={CUSTOM_RATIO}>Custom…</option>
            </Select>
          </div>
          {presetId === CUSTOM_RATIO && (
            <div className="space-y-1.5">
              <Label htmlFor="customRatio">Custom ratio -- 1 : N</Label>
              <Input id="customRatio" type="number" min="1" value={customRatio} onChange={(e) => setCustomRatio(e.target.value)} />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          You can refine this with a calibration line, or change it later, once the plan is open.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending || !file || !name} onClick={submit}>
          {pending ? "Uploading…" : "Create takeoff"}
        </Button>
        {message && <p className="text-sm text-destructive">{message}</p>}
      </div>
    </div>
  );
}
