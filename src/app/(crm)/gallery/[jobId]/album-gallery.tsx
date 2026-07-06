"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, Link2, Share2, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { BeforeAfterSlider } from "@/components/gallery/before-after-slider";
import { photoCategories, photoCategoryLabels } from "@/validators/completion";
import type { AlbumPhoto } from "@/services/media.service";
import { pairPhotosAction, unpairPhotoAction } from "./actions";

export function AlbumGallery({ jobId, photos }: { jobId: string; photos: AlbumPhoto[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p])), [photos]);

  const pairs = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ before: AlbumPhoto; after: AlbumPhoto }> = [];
    for (const p of photos) {
      if (!p.pairedWithId || seen.has(p.id)) continue;
      const other = byId[p.pairedWithId];
      if (!other) continue;
      seen.add(p.id);
      seen.add(other.id);
      const before = p.category === "AFTER" ? other : p;
      const after = p.category === "AFTER" ? p : other;
      result.push({ before, after });
    }
    return result;
  }, [photos, byId]);

  const pairedIds = new Set(pairs.flatMap((p) => [p.before.id, p.after.id]));
  const unpaired = photos.filter((p) => !pairedIds.has(p.id));

  function submitPair() {
    setError(null);
    if (!pairA || !pairB || pairA === pairB) {
      setError("Pick two different photos to pair.");
      return;
    }
    startTransition(async () => {
      const result = await pairPhotosAction(jobId, pairA, pairB);
      if (!result.ok) setError(result.message);
      else {
        setPairA("");
        setPairB("");
      }
    });
  }

  function labelFor(p: AlbumPhoto) {
    const cat = photoCategoryLabels[p.category as keyof typeof photoCategoryLabels] ?? p.category ?? "Photo";
    return `${cat} — ${new Date(p.createdAt).toLocaleDateString("en-GB")}`;
  }

  return (
    <div className="space-y-8">
      {pairs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Before / after comparisons</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {pairs.map(({ before, after }) => (
              <div key={before.id} className="space-y-2">
                <BeforeAfterSlider beforeUrl={before.url} afterUrl={after.url} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={after.url} download>
                      <Download className="h-3.5 w-3.5" /> Download after
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" disabled title="Coming in Milestone 11 — customer portal">
                    <Share2 className="h-3.5 w-3.5" /> Share to portal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => startTransition(() => unpairPhotoAction(jobId, before.id))}
                  >
                    <Unlink className="h-3.5 w-3.5" /> Unpair
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unpaired.length >= 2 && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pair a before with an after</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={pairA} onChange={(e) => setPairA(e.target.value)}>
              <option value="">Select a photo…</option>
              {unpaired.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelFor(p)}
                </option>
              ))}
            </Select>
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select value={pairB} onChange={(e) => setPairB(e.target.value)}>
              <option value="">Select a photo…</option>
              {unpaired.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelFor(p)}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={submitPair} disabled={pending}>
              Pair
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {photoCategories.map((cat) => {
        const list = photos.filter((p) => p.category === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {photoCategoryLabels[cat]} ({list.length})
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {list.map((p) => {
                const idx = photos.findIndex((x) => x.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox(idx)}
                    className="group relative aspect-square overflow-hidden rounded-md border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnailUrl ?? p.url} alt={cat} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    {p.pairedWithId && (
                      <span className="absolute right-1 top-1 rounded-full bg-brand-plum p-1">
                        <Link2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {lightbox != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)} aria-label="Close">
            <X className="h-6 w-6" />
          </button>
          {lightbox > 0 && (
            <button
              className="absolute left-4 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i !== null && i > 0 ? i - 1 : i));
              }}
              aria-label="Previous"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[lightbox].url} alt="" className="max-h-full max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
          {lightbox < photos.length - 1 && (
            <button
              className="absolute right-4 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
              }}
              aria-label="Next"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
