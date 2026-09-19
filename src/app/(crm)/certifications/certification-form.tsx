"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { certOwnerTypes, certOwnerTypeLabels, certCategorySuggestions } from "@/validators/certification";
import type { CertificationInput } from "@/validators/certification";
import type { CertificationDetail } from "@/services/certification.service";
import { createCertificationAction, updateCertificationAction } from "./actions";

type StaffOption = { id: string; name: string };

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CertificationForm({ certification, staff, storageReady }: { certification?: CertificationDetail; staff: StaffOption[]; storageReady: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(certification?.name ?? "");
  const [category, setCategory] = useState(certification?.category ?? "");
  const [ownerType, setOwnerType] = useState<(typeof certOwnerTypes)[number]>(certification?.ownerType ?? "BUSINESS");
  const [userId, setUserId] = useState(certification?.userId ?? "");
  const [issueDate, setIssueDate] = useState(toDateInputValue(certification?.issueDate));
  const [expiryDate, setExpiryDate] = useState(toDateInputValue(certification?.expiryDate));
  const [reference, setReference] = useState(certification?.reference ?? "");
  const [notes, setNotes] = useState(certification?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const categoryOptions: ComboboxOption[] = certCategorySuggestions.map((c) => ({ value: c, label: c }));

  function submit() {
    setMessage(null);
    setErrors({});

    startTransition(async () => {
      let fileUrl: string | undefined;

      if (file) {
        if (!storageReady) {
          setMessage({ ok: false, text: "Storage isn't connected yet — set the SUPABASE_* storage env vars to enable file uploads." });
          return;
        }
        try {
          const presignRes = await fetch("/api/uploads/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
          });
          const presign = await presignRes.json();
          if (!presign.configured) {
            setMessage({ ok: false, text: "Storage isn't connected yet — set the SUPABASE_* storage env vars to enable file uploads." });
            return;
          }
          await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
          fileUrl = presign.path;
        } catch {
          setMessage({ ok: false, text: "File upload failed — please try again." });
          return;
        }
      }

      const input: CertificationInput = {
        name,
        category,
        ownerType,
        userId: ownerType === "PERSON" ? userId || undefined : undefined,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: new Date(expiryDate),
        reference: reference || undefined,
        fileUrl,
        notes: notes || undefined,
      };

      const result = certification ? await updateCertificationAction(certification.id, input) : await createCertificationAction(input);
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        setErrors(result.errors ?? {});
        return;
      }
      router.push("/certifications");
    });
  }

  return (
    <div className="space-y-5">
      {!storageReady && (
        <p className="text-xs text-muted-foreground">
          Storage isn&apos;t connected yet, so a chosen file won&apos;t be saved — set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_STORAGE_BUCKET to activate this. Everything else still saves normally.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Public Liability Insurance" />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category *</Label>
          <Combobox id="category" options={categoryOptions} value={category} onChange={setCategory} onSelect={(o) => setCategory(o.value)} placeholder="e.g. Insurance, CSCS, DBS…" />
          {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ownerType">Belongs to *</Label>
          <Select
            id="ownerType"
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value as (typeof certOwnerTypes)[number])}
          >
            {certOwnerTypes.map((t) => (
              <option key={t} value={t}>{certOwnerTypeLabels[t]}</option>
            ))}
          </Select>
        </div>

        {ownerType === "PERSON" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="userId">Person *</Label>
            <Select id="userId" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select a person…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {errors.userId && <p className="text-xs text-destructive">{errors.userId}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="issueDate">Issue date</Label>
          <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiryDate">Expiry date *</Label>
          <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="reference">Reference (policy / certificate number)</Label>
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>File (PDF or photo)</Label>
          {certification?.fileUrl && !file && (
            <p className="text-xs text-muted-foreground">
              Current file: <a href={certification.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">view</a> — choose a new file below to replace it.
            </p>
          )}
          <label className="flex h-9 w-full cursor-pointer items-center gap-2 truncate rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-accent">
            <Upload className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{file ? file.name : "Choose a file"}</span>
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending || !name || !category || !expiryDate} onClick={submit}>
          {pending ? "Saving…" : certification ? "Save" : "Add certification"}
        </Button>
        {message && !message.ok && <p className="text-sm text-destructive">{message.text}</p>}
      </div>
    </div>
  );
}
