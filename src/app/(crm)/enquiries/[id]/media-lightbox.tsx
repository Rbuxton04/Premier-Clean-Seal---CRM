"use client";

import { useState } from "react";
import { X, Video as VideoIcon } from "lucide-react";

type MediaItem = { id: string; url: string; thumbnailUrl: string | null; kind: string; mimeType: string };

export function MediaLightbox({ files }: { files: MediaItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = files.find((f) => f.id === openId) ?? null;

  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos or videos were attached to this enquiry.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {files.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setOpenId(f.id)}
            className="aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {f.kind === "VIDEO" ? (
              <div className="flex h-full w-full items-center justify-center">
                <VideoIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.thumbnailUrl ?? f.url} alt="" className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpenId(null)}
        >
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {open.kind === "VIDEO" ? (
            <video src={open.url} controls autoPlay className="max-h-full max-w-full rounded-md" onClick={(e) => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt="" className="max-h-full max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </>
  );
}
