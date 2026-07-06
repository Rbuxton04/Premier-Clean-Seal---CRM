"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setPct(ratio * 100);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  }
  function onPointerUp() {
    dragging.current = false;
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-lg border"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      </div>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pct}%` }} />
      <div
        className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md"
        style={{ left: `${pct}%` }}
      >
        <GripVertical className="h-4 w-4 text-brand-plum" />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs font-medium text-white">{beforeLabel}</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs font-medium text-white">{afterLabel}</span>
    </div>
  );
}
