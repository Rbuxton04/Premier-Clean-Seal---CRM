"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { documentCategories, documentCategoryLabels } from "@/validators/media";
import { uploadDocumentAction } from "./actions";

type CustomerOption = { id: string; name: string; company: string | null };
type JobOption = { id: string; jobNumber: string; customer: { id: string; name: string } };

export function DocumentUploadForm({
  storageReady,
  customers,
  jobs,
}: {
  storageReady: boolean;
  customers: CustomerOption[];
  jobs: JobOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState("");
  const [customerText, setCustomerText] = useState("");
  const [jobId, setJobId] = useState("");
  const [category, setCategory] = useState<(typeof documentCategories)[number]>("RAMS");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const customerOptions: ComboboxOption[] = customers.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} (${c.company})` : c.name,
  }));

  function submit() {
    setMessage(null);
    if (!file) {
      setMessage({ ok: false, text: "Choose a file to upload." });
      return;
    }
    if (!storageReady) {
      setMessage({ ok: false, text: "Storage isn't connected yet — set the SUPABASE_* storage env vars to enable uploads." });
      return;
    }

    startTransition(async () => {
      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
        });
        const presign = await presignRes.json();
        if (!presign.configured) {
          setMessage({ ok: false, text: "Storage isn't connected yet — set the SUPABASE_* storage env vars to enable uploads." });
          return;
        }

        await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });

        const result = await uploadDocumentAction({
          customerId: customerId || undefined,
          jobId: jobId || undefined,
          category,
          url: presign.path,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        if (!result.ok) {
          setMessage({ ok: false, text: result.message });
          return;
        }
        setMessage({ ok: true, text: "Document uploaded." });
        setFile(null);
        setCustomerId("");
        setCustomerText("");
        setJobId("");
      } catch {
        setMessage({ ok: false, text: "Upload failed — please try again." });
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-semibold">Upload a document</p>
      {!storageReady && (
        <p className="text-xs text-muted-foreground">
          Storage isn&apos;t connected yet, so uploads won&apos;t be saved — set NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET to activate this. The form still works so you can see how it&apos;ll look.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Customer (optional)</Label>
          <Combobox
            options={customerOptions}
            value={customerText}
            placeholder="Search customers…"
            onChange={(text) => {
              setCustomerText(text);
              setCustomerId("");
            }}
            onSelect={(opt) => {
              setCustomerText(opt.label);
              setCustomerId(opt.value);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Job (optional)</Label>
          <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">No specific job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobNumber} — {j.customer.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {documentCategories.map((c) => (
              <option key={c} value={c}>
                {documentCategoryLabels[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>File</Label>
          <label className="flex h-9 cursor-pointer items-center gap-2 truncate rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-accent">
            <Upload className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{file ? file.name : "Choose a file"}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
      {message && <p className={`text-xs ${message.ok ? "text-emerald-600" : "text-destructive"}`}>{message.text}</p>}
      <Button size="sm" disabled={pending} onClick={submit}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
    </div>
  );
}
