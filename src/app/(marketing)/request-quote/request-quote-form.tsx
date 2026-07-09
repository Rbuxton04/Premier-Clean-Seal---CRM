"use client";

import { useState } from "react";
import { CheckCircle2, ImageOff, Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { propertyTypes, propertyTypeLabels } from "@/validators/customer";
import { workTypes, workTypeLabels, contactMethods, contactMethodLabels } from "@/validators/enquiry";

type UploadedFile = { url: string; thumbnailUrl?: string; mimeType: string; sizeBytes: number; kind: "PHOTO" | "VIDEO" };

type SelectedFile = { file: File; previewUrl: string };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB -- a short phone video

export function RequestQuoteForm({ photosEnabled }: { photosEnabled: boolean }) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [formRenderedAt] = useState(() => Date.now());

  function toggleWorkType(value: string) {
    setSelectedWorkTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    e.target.value = "";
  }

  function removeFile(previewUrl: string) {
    setSelectedFiles((prev) => prev.filter((f) => f.previewUrl !== previewUrl));
  }

  async function uploadFiles(): Promise<{ files: UploadedFile[]; failed: string[] }> {
    if (!photosEnabled || selectedFiles.length === 0) return { files: [], failed: [] };

    const uploaded: UploadedFile[] = [];
    const failed: string[] = [];

    for (const { file } of selectedFiles) {
      const isVideo = file.type.startsWith("video");
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        failed.push(`${file.name} (too large — max ${isVideo ? "100MB" : "15MB"})`);
        continue;
      }

      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size, mediaOnly: true }),
        });
        const presign = await presignRes.json();
        if (!presignRes.ok) {
          failed.push(`${file.name} (${presign.message ?? "upload rejected"})`);
          continue;
        }
        if (!presign.configured) continue; // storage not live yet — skip silently, unrelated to per-file failures

        const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!putRes.ok) {
          failed.push(`${file.name} (upload failed)`);
          continue;
        }

        uploaded.push({
          url: presign.path,
          mimeType: file.type,
          sizeBytes: file.size,
          kind: isVideo ? "VIDEO" : "PHOTO",
        });
      } catch {
        failed.push(`${file.name} (network error)`);
      }
    }
    return { files: uploaded, failed };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (selectedWorkTypes.length === 0) {
      setError("Select at least one type of work.");
      return;
    }
    if (!consentGiven) {
      setError("Please tick the consent box to submit this form.");
      return;
    }

    const form = e.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    try {
      const { files, failed } = await uploadFiles();
      setUploadWarning(
        failed.length > 0
          ? `Couldn't attach: ${failed.join(", ")}. The rest of your enquiry will still be sent${files.length > 0 ? " with the files that did upload." : "."}`
          : null
      );

      const res = await fetch("/api/public/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          company: data.get("company") || undefined,
          phone: data.get("phone"),
          email: data.get("email"),
          addressText: data.get("addressText"),
          postcode: data.get("postcode"),
          propertyType: data.get("propertyType"),
          workTypes: selectedWorkTypes,
          description: data.get("description"),
          preferredContact: data.get("preferredContact"),
          preferredDate: data.get("preferredDate") || undefined,
          consentGiven,
          files,
          website: data.get("website") || "",
          formRenderedAt,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const fileIssue = json.errors?.files?.[0];
        setError(fileIssue ? `${json.message ?? "Please check the form and try again."} (${fileIssue})` : json.message ?? "Something went wrong — please try again.");
        setFieldErrors(json.errors ?? {});
        return;
      }
      setSuccess(true);
    } catch {
      setError("Couldn't reach the server — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 font-display text-xl font-semibold">Thanks — your request is in!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve received your enquiry and will be in touch within one working day. If it&apos;s urgent, feel free to call us directly.
        </p>
        {uploadWarning && <p className="mt-3 text-sm text-amber-700">{uploadWarning}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-lg border bg-card p-6">
      {/* Honeypot — hidden from real visitors, bots often fill every field. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" name="company" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone *</Label>
          <Input id="phone" name="phone" type="tel" required />
          {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" required />
          {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="addressText">Address *</Label>
          <Input id="addressText" name="addressText" placeholder="House name/number and street" required />
          {fieldErrors.addressText && <p className="text-xs text-destructive">{fieldErrors.addressText[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postcode">Postcode *</Label>
          <Input id="postcode" name="postcode" required />
          {fieldErrors.postcode && <p className="text-xs text-destructive">{fieldErrors.postcode[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="propertyType">Property type</Label>
          <Select id="propertyType" name="propertyType" defaultValue="RESIDENTIAL">
            {propertyTypes.map((t) => <option key={t} value={t}>{propertyTypeLabels[t]}</option>)}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Type of work *</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {workTypes.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox checked={selectedWorkTypes.includes(t)} onChange={() => toggleWorkType(t)} />
              {workTypeLabels[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Tell us about the job *</Label>
        <Textarea id="description" name="description" rows={4} required placeholder="What needs sealing, roughly how much, any access notes…" />
        {fieldErrors.description && <p className="text-xs text-destructive">{fieldErrors.description[0]}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="preferredContact">Preferred contact method</Label>
          <Select id="preferredContact" name="preferredContact" defaultValue="PHONE">
            {contactMethods.map((c) => <option key={c} value={c}>{contactMethodLabels[c]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preferredDate">Preferred appointment date (optional)</Label>
          <Input id="preferredDate" name="preferredDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Photos or videos (optional)</Label>
        {photosEnabled ? (
          <>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" /> Add photos or a short video
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFilesPicked} />
            </label>
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((f) => (
                  <div key={f.previewUrl} className="relative h-16 w-16 overflow-hidden rounded-md border">
                    {f.file.type.startsWith("video") ? (
                      <video src={f.previewUrl} className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(f.previewUrl)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                      aria-label="Remove file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent">
            <Upload className="h-4 w-4" /> Add photos or a short video
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFilesPicked} />
          </label>
        )}
        {!photosEnabled && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ImageOff className="h-3.5 w-3.5" />
            {selectedFiles.length > 0
              ? `${selectedFiles.length} file(s) selected — uploads open soon, so these won't be sent yet. Mention them in the description and we'll follow up.`
              : "Photo/video upload opens soon. Feel free to describe the job in detail below."}
          </p>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-0.5" required />
        <span>
          I consent to Premier Clean &amp; Seal storing and using these details to respond to my enquiry. *
        </span>
      </label>

      {uploadWarning && <p className="text-sm text-amber-700">{uploadWarning}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Request my free quote"}
      </Button>
    </form>
  );
}
