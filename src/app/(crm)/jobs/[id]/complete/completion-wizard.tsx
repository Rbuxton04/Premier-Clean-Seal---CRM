"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Camera, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { applicationAreas, applicationAreaLabels, photoCategories, photoCategoryLabels } from "@/validators/completion";
import type { CompletionInput } from "@/validators/completion";
import type { ProductOption } from "@/services/property.service";
import { finishJobAction } from "./actions";
import { SignaturePad } from "./signature-pad";

function resizeImageFile(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type MaterialRow = {
  productId?: string;
  comboText: string;
  productText: string;
  colour: string;
  applicationArea: (typeof applicationAreas)[number];
  batchNumber: string;
  quantityUsed: string;
  unit: string;
  cost: string;
};

function emptyMaterial(): MaterialRow {
  return { comboText: "", productText: "", colour: "", applicationArea: "BATHROOM", batchNumber: "", quantityUsed: "1", unit: "tubes", cost: "" };
}

type PhotoItem = { category: (typeof photoCategories)[number]; dataUrl: string; name: string };

function toDatetimeLocal(d: Date | null): string {
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CompletionWizard({
  jobId,
  scheduledStart,
  products,
}: {
  jobId: string;
  scheduledStart: Date | null;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [materials, setMaterials] = useState<MaterialRow[]>([emptyMaterial()]);
  const [metresInstalled, setMetresInstalled] = useState("");
  const [actualStart, setActualStart] = useState(toDatetimeLocal(scheduledStart));
  const [actualEnd, setActualEnd] = useState(toDatetimeLocal(new Date()));
  const [completionNotes, setCompletionNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const productOptions: ComboboxOption[] = products.map((p) => ({
    value: p.id,
    label: `${p.manufacturer} ${p.name} — ${p.colour}`,
    meta: { productText: `${p.manufacturer} ${p.name}`, colour: p.colour },
  }));

  function updateMaterial(index: number, patch: Partial<MaterialRow>) {
    setMaterials((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function removeMaterial(index: number) {
    setMaterials((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handlePhotoFiles(category: (typeof photoCategories)[number], files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoBusy(true);
    try {
      const items: PhotoItem[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await resizeImageFile(file);
        items.push({ category, dataUrl, name: file.name });
      }
      setPhotos((prev) => [...prev, ...items]);
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    setError(null);

    for (const m of materials) {
      if (!m.productText.trim() || !m.colour.trim()) {
        setError("Every material needs a product and colour — pick one from the list or type it in.");
        return;
      }
      if (!m.quantityUsed || Number(m.quantityUsed) <= 0) {
        setError("Quantity used must be greater than 0 for every material.");
        return;
      }
    }

    const input: CompletionInput = {
      materials: materials.map((m) => ({
        productId: m.productId || undefined,
        productText: m.productText.trim(),
        colour: m.colour.trim(),
        applicationArea: m.applicationArea,
        batchNumber: m.batchNumber.trim() || undefined,
        quantityUsed: Number(m.quantityUsed),
        unit: m.unit.trim() || "tubes",
        cost: m.cost ? Number(m.cost) : undefined,
      })),
      metresInstalled: metresInstalled ? Number(metresInstalled) : undefined,
      actualStart: actualStart ? new Date(actualStart) : undefined,
      actualEnd: actualEnd ? new Date(actualEnd) : undefined,
      completionNotes: completionNotes.trim() || undefined,
      satisfactionRating: rating > 0 ? rating : undefined,
      signatureDataUrl: signatureDataUrl ?? undefined,
      photos: photos.length > 0 ? photos.map((p) => ({ category: p.category, dataUrl: p.dataUrl })) : undefined,
    };

    startTransition(async () => {
      const result = await finishJobAction(jobId, input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/jobs/${result.jobId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materials used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {materials.map((m, i) => (
            <div key={i} className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label>Product / colour *</Label>
                {materials.length > 1 && (
                  <button type="button" onClick={() => removeMaterial(i)} aria-label="Remove material" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Combobox
                options={productOptions}
                value={m.comboText}
                placeholder="Pick from catalogue or type a colour, e.g. Kelmore Mocha"
                onChange={(text) => updateMaterial(i, { comboText: text, productId: undefined, productText: text, colour: text })}
                onSelect={(opt) => updateMaterial(i, { comboText: opt.label, productId: opt.value, productText: opt.meta!.productText, colour: opt.meta!.colour })}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Area</Label>
                  <Select value={m.applicationArea} onChange={(e) => updateMaterial(i, { applicationArea: e.target.value as MaterialRow["applicationArea"] })}>
                    {applicationAreas.map((a) => (
                      <option key={a} value={a}>{applicationAreaLabels[a]}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Batch number</Label>
                  <Input value={m.batchNumber} onChange={(e) => updateMaterial(i, { batchNumber: e.target.value })} placeholder="For warranty traceability" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Quantity *</Label>
                  <Input type="number" min="0" step="0.5" value={m.quantityUsed} onChange={(e) => updateMaterial(i, { quantityUsed: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Input value={m.unit} onChange={(e) => updateMaterial(i, { unit: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cost (£)</Label>
                  <Input type="number" min="0" step="0.01" value={m.cost} onChange={(e) => updateMaterial(i, { cost: e.target.value })} />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={() => setMaterials((prev) => [...prev, emptyMaterial()])}>
            <Plus className="h-3.5 w-3.5" /> Add another material
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metres &amp; time on site</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Metres installed</Label>
            <Input type="number" min="0" step="0.1" value={metresInstalled} onChange={(e) => setMetresInstalled(e.target.value)} />
          </div>
          <div />
          <div className="space-y-1.5">
            <Label>Started</Label>
            <Input type="datetime-local" value={actualStart} onChange={(e) => setActualStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Finished</Label>
            <Input type="datetime-local" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={4} value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Anything the customer or office should know…" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {photoCategories.map((cat) => (
            <div key={cat} className="space-y-2">
              <Label>{photoCategoryLabels[cat]}</Label>
              <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-accent">
                <Camera className="h-4 w-4" /> Add {photoCategoryLabels[cat].toLowerCase()} photos
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handlePhotoFiles(cat, e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {photos.filter((p) => p.category === cat).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) =>
                    p.category === cat ? (
                      <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          ))}
          {photoBusy && <p className="text-xs text-muted-foreground">Processing photo…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer signature</CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePad onChange={setSignatureDataUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Satisfaction rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} stars`}>
                <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" size="lg" className="w-full" disabled={pending || photoBusy} onClick={submit}>
        {pending ? "Generating…" : "Finish & generate"}
      </Button>
    </div>
  );
}
