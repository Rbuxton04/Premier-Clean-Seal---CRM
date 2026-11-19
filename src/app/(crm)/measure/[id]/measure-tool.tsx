"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Undo2, Eraser, MousePointer2, Link2, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ensurePdfWorkerConfigured } from "../pdf-worker-setup";
import type { TakeoffDetail, TakeoffItemDetail } from "@/services/takeoff.service";
import type { ScalePresetItem } from "@/services/scale-preset.service";
import type { RateCardItem } from "@/services/takeoff-rate-card.service";
import { chainLengthPoints, resolvePointsPerMetre, computeMeasurementMetres, type Point } from "@/validators/takeoff";
import {
  createMeasurementAction, updateMeasurementLabelAction, deleteMeasurementAction, clearAllMeasurementsAction,
  createTakeoffItemAction, updateTakeoffItemAction, deleteTakeoffItemAction,
  updateTakeoffScaleAction, updateTakeoffDetailsAction, createScalePresetAction,
  addAllFromRateCardAction, saveItemAsPresetAction,
} from "../actions";
import { ItemsPanel } from "./items-panel";
import { ScaleControls } from "./scale-controls";
import { OutputActions } from "./output-actions";

type CustomerOption = { id: string; name: string; company: string | null };

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export function MeasureTool({
  takeoff, presets, customers, rateCardItems,
}: { takeoff: TakeoffDetail; presets: ScalePresetItem[]; customers: CustomerOption[]; rateCardItems: RateCardItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // The loaded document lives in STATE, not just a ref -- a ref write alone
  // never triggers a re-render, so the render effect below needs a state
  // value to depend on. (A previous version depended on `numPages` instead,
  // which is wrong: setNumPages(doc.numPages) is a no-op re-render whenever
  // a PDF has exactly 1 page, same value as the initial useState(1) -- so
  // for any single-page plan, the canvas was never drawn at all. This is
  // the actual cause of the live "blank plan" report, not a worker/CORS
  // issue -- the worker file serves with a correct content-type in
  // production; curl confirmed it.)
  const [pdfDoc, setPdfDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderScale, setRenderScale] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [pointsPerMetre, setPointsPerMetre] = useState(takeoff.pointsPerMetre);
  const [scaleRatioLabel, setScaleRatioLabel] = useState(takeoff.scaleRatioLabel);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationPrompt, setCalibrationPrompt] = useState<{ screenPixels: number } | null>(null);
  const [calibrationMetres, setCalibrationMetres] = useState("");

  const [items, setItems] = useState<TakeoffItemDetail[]>(takeoff.items);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(takeoff.items[0]?.id ?? null);

  const [chainModeOn, setChainModeOn] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [drawIsChain, setDrawIsChain] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<{ itemId: string; measurementId: string } | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // --- Load the PDF document once -----------------------------------------
  // Streamed through a same-origin, auth-gated proxy (/api/takeoffs/[id]/file)
  // rather than fetching the signed Supabase Storage URL directly from the
  // browser -- this avoids a signed URL ever expiring on a page left open,
  // sidesteps any cross-origin/range-request quirks fetching Supabase
  // Storage directly, and gives a real, specific HTTP error (404/500 with a
  // message) if the stored file is actually missing, instead of pdf.js
  // trying to fetch a relative path when URL-resolution silently falls back
  // to the raw storage path.
  useEffect(() => {
    ensurePdfWorkerConfigured();
    let cancelled = false;
    setPdfError(null);
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const doc = await pdfjsLib.getDocument({ url: `/api/takeoffs/${takeoff.id}/file`, disableRange: true, disableStream: true }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : "Could not load this PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [takeoff.id]);

  // --- Render the current page at the current zoom -----------------------
  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!pdfDoc || !canvas) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: renderScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setViewportSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Could not render this page.");
    }
  }, [pdfDoc, currentPage, renderScale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // --- Keyboard: Escape cancels a draw/calibration, Enter finishes a chain ---
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawPoints([]);
        setCalibrationPoints([]);
        setCalibrating(false);
      } else if (e.key === "Enter" && drawIsChain && drawPoints.length >= 2) {
        finalizeMeasurement(drawPoints, "CHAIN");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawPoints, drawIsChain]);

  function screenToPoint(clientX: number, clientY: number): Point {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / renderScale, y: (clientY - rect.top) / renderScale };
  }

  function pointToScreen(p: Point): Point {
    return { x: p.x * renderScale, y: p.y * renderScale };
  }

  /**
   * Mirrors what updateTakeoffScale does server-side: every existing
   * measurement's computedMetres is stale once pointsPerMetre changes
   * (points are stored zoom-independent, but computedMetres is a cached
   * figure), so the local mirror needs the same recompute or the side
   * panel and tile labels would show the old scale's numbers until a full
   * reload.
   */
  function recomputeItemsForScale(newPointsPerMetre: number) {
    setItems((cur) =>
      cur.map((it) => {
        const measurements = it.measurements.map((m) => ({ ...m, computedMetres: computeMeasurementMetres(m.points, newPointsPerMetre) }));
        const totalMetres = +measurements.reduce((sum, m) => sum + Number(m.computedMetres), 0).toFixed(2);
        return { ...it, measurements, totalMetres, lineTotalGbp: +(totalMetres * Number(it.pricePerMetre)).toFixed(2) };
      })
    );
  }

  // --- Calibration -------------------------------------------------------
  function handleCalibrationClick(e: React.MouseEvent) {
    const p = screenToPoint(e.clientX, e.clientY);
    const next = [...calibrationPoints, p];
    if (next.length < 2) {
      setCalibrationPoints(next);
      return;
    }
    const screenPixels = chainLengthPoints(next) * renderScale;
    setCalibrationPrompt({ screenPixels });
    setCalibrationPoints(next);
  }

  async function applyCalibration() {
    const metres = Number(calibrationMetres);
    if (!calibrationPrompt || !metres || metres <= 0) return;
    const result = await updateTakeoffScaleAction(takeoff.id, {
      calibration: { screenPixels: calibrationPrompt.screenPixels, renderScale, realMetres: metres },
    });
    if (result.ok) {
      const resolved = resolvePointsPerMetre({ calibration: { screenPixels: calibrationPrompt.screenPixels, renderScale, realMetres: metres } });
      setPointsPerMetre(resolved.pointsPerMetre);
      setScaleRatioLabel(null);
      recomputeItemsForScale(resolved.pointsPerMetre);
    } else {
      setMessage(result.message);
    }
    setCalibrating(false);
    setCalibrationPoints([]);
    setCalibrationPrompt(null);
    setCalibrationMetres("");
  }

  // --- Scale ratio change --------------------------------------------------
  async function handleApplyRatio(ratio: number, label: string | null) {
    const result = await updateTakeoffScaleAction(takeoff.id, { ratio, label: label ?? undefined });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const resolved = resolvePointsPerMetre({ ratio, label: label ?? undefined });
    setPointsPerMetre(resolved.pointsPerMetre);
    setScaleRatioLabel(resolved.scaleRatioLabel);
    recomputeItemsForScale(resolved.pointsPerMetre);
  }

  async function handleSaveCustomPreset(label: string, ratio: number) {
    await createScalePresetAction({ label, ratio });
  }

  // --- Measuring -----------------------------------------------------------
  async function finalizeMeasurement(points: Point[], type: "LENGTH" | "CHAIN") {
    if (!selectedItemId) {
      setMessage("Select an item first.");
      setDrawPoints([]);
      return;
    }
    const result = await createMeasurementAction(
      takeoff.id,
      { takeoffItemId: selectedItemId, pageNumber: currentPage, type, points },
      pointsPerMetre
    );
    setDrawPoints([]);
    setHoverPoint(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setItems((cur) =>
      cur.map((it) =>
        it.id === selectedItemId
          ? {
              ...it,
              measurements: [...it.measurements, { id: result.data.id, pageNumber: currentPage, type, points, computedMetres: result.data.computedMetres, label: null }],
              totalMetres: +(it.totalMetres + result.data.computedMetres).toFixed(2),
              lineTotalGbp: +((it.totalMetres + result.data.computedMetres) * Number(it.pricePerMetre)).toFixed(2),
            }
          : it
      )
    );
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.detail > 1) return; // double-click is handled separately, below
    if (calibrating) {
      handleCalibrationClick(e);
      return;
    }
    if (!selectedItemId) {
      setMessage("Select or add an item before measuring.");
      return;
    }
    const p = screenToPoint(e.clientX, e.clientY);
    const wantsChain = e.ctrlKey || e.metaKey || chainModeOn;

    if (drawPoints.length === 0) {
      setDrawPoints([p]);
      setDrawIsChain(wantsChain);
      return;
    }
    if (!drawIsChain) {
      finalizeMeasurement([...drawPoints, p], "LENGTH");
      return;
    }
    setDrawPoints((pts) => [...pts, p]);
  }

  function handleOverlayDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (drawIsChain && drawPoints.length >= 2) finalizeMeasurement(drawPoints, "CHAIN");
  }

  function handleOverlayMouseMove(e: React.MouseEvent) {
    if (drawPoints.length === 0 && !calibrating) return;
    setHoverPoint(screenToPoint(e.clientX, e.clientY));
  }

  function undoLastPoint() {
    setDrawPoints((pts) => pts.slice(0, -1));
  }

  /**
   * Client-side only -- flattens the rendered PDF canvas plus the SVG
   * measurement overlay (serialised to an image) into one PNG at the
   * current zoom, for a quick share/attach when the full marked-up PDF
   * export is more than is needed. Both layers are same-origin (pdf.js
   * renders the PDF itself via Canvas 2D drawing calls, not a cross-origin
   * <img>; the SVG is serialised to a blob: URL), so the canvas isn't
   * tainted and toBlob() works.
   */
  async function savePageAsImage() {
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) return;

    const svgString = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const overlayImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not render the measurement overlay."));
        img.src = svgUrl;
      });

      const outCanvas = document.createElement("canvas");
      outCanvas.width = canvas.width;
      outCanvas.height = canvas.height;
      const ctx = outCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(canvas, 0, 0);
      ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);

      const blob: Blob | null = await new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"));
      if (!blob) {
        setMessage("Could not save this page as an image.");
        return;
      }
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${takeoff.name} - page ${currentPage}.png`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setMessage("Could not save this page as an image.");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function clearAll() {
    if (!window.confirm("Clear every measurement on this takeoff? Items and rates are kept.")) return;
    const result = await clearAllMeasurementsAction(takeoff.id);
    if (result.ok) setItems((cur) => cur.map((it) => ({ ...it, measurements: [], totalMetres: 0, lineTotalGbp: 0 })));
  }

  // --- Items -----------------------------------------------------------
  async function handleCreateItem(name: string, colour: string, pricePerMetre: number) {
    const result = await createTakeoffItemAction(takeoff.id, { name, colour, pricePerMetre, sortOrder: items.length });
    if (result.ok) {
      const newItem: TakeoffItemDetail = { id: result.data.id, name, colour, pricePerMetre, sortOrder: items.length, measurements: [], totalMetres: 0, lineTotalGbp: 0 };
      setItems((cur) => [...cur, newItem]);
      setSelectedItemId(newItem.id);
    } else {
      setMessage(result.message);
    }
  }

  async function handleUpdateItemRate(id: string, pricePerMetre: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const result = await updateTakeoffItemAction(takeoff.id, id, { name: item.name, colour: item.colour, pricePerMetre, sortOrder: item.sortOrder });
    if (result.ok) {
      setItems((cur) => cur.map((it) => (it.id === id ? { ...it, pricePerMetre, lineTotalGbp: +(it.totalMetres * pricePerMetre).toFixed(2) } : it)));
    }
  }

  async function handleAddAllFromRateCard() {
    const result = await addAllFromRateCardAction(takeoff.id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.data.length === 0) {
      setMessage("Every rate card item is already on this takeoff.");
      return;
    }
    setItems((cur) => [
      ...cur,
      ...result.data.map((p): TakeoffItemDetail => ({
        id: p.id, name: p.name, colour: p.colour, pricePerMetre: Number(p.pricePerMetre), sortOrder: p.sortOrder,
        measurements: [], totalMetres: 0, lineTotalGbp: 0,
      })),
    ]);
  }

  /** Save-to-rate-card never changes anything on THIS takeoff -- it only writes the shared rate card. */
  async function handleSaveItemToRateCard(item: TakeoffItemDetail) {
    await saveItemAsPresetAction(item.name, item.colour, Number(item.pricePerMetre));
  }

  async function handleDeleteItem(id: string) {
    if (!window.confirm("Delete this item and all its measurements?")) return;
    const result = await deleteTakeoffItemAction(takeoff.id, id);
    if (result.ok) {
      setItems((cur) => cur.filter((it) => it.id !== id));
      if (selectedItemId === id) setSelectedItemId(null);
    }
  }

  // --- Selected (existing) measurement edit/delete -----------------------
  function selectMeasurement(itemId: string, measurementId: string, currentLabel: string | null) {
    setSelectedMeasurement({ itemId, measurementId });
    setLabelDraft(currentLabel ?? "");
  }

  async function saveLabel() {
    if (!selectedMeasurement) return;
    await updateMeasurementLabelAction(takeoff.id, selectedMeasurement.measurementId, labelDraft);
    setItems((cur) =>
      cur.map((it) =>
        it.id === selectedMeasurement.itemId
          ? { ...it, measurements: it.measurements.map((m) => (m.id === selectedMeasurement.measurementId ? { ...m, label: labelDraft || null } : m)) }
          : it
      )
    );
    setSelectedMeasurement(null);
  }

  async function deleteSelectedMeasurement() {
    if (!selectedMeasurement) return;
    const result = await deleteMeasurementAction(takeoff.id, selectedMeasurement.measurementId);
    if (result.ok) {
      setItems((cur) =>
        cur.map((it) => {
          if (it.id !== selectedMeasurement.itemId) return it;
          const removed = it.measurements.find((m) => m.id === selectedMeasurement.measurementId);
          const newTotal = +(it.totalMetres - Number(removed?.computedMetres ?? 0)).toFixed(2);
          return {
            ...it,
            measurements: it.measurements.filter((m) => m.id !== selectedMeasurement.measurementId),
            totalMetres: newTotal,
            lineTotalGbp: +(newTotal * Number(it.pricePerMetre)).toFixed(2),
          };
        })
      );
    }
    setSelectedMeasurement(null);
  }

  const totalMetres = +items.reduce((sum, i) => sum + i.totalMetres, 0).toFixed(2);
  const grandTotalGbp = +items.reduce((sum, i) => sum + i.lineTotalGbp, 0).toFixed(2);
  const pageMeasurements = items.flatMap((it) => it.measurements.filter((m) => m.pageNumber === currentPage).map((m) => ({ ...m, colour: it.colour, itemId: it.id })));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs">Page {currentPage} of {numPages}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-2 h-5 w-px bg-border" />
          <Button type="button" size="sm" variant="outline" onClick={() => setRenderScale((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-xs">{Math.round(renderScale * 100)}%</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setRenderScale((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-2 h-5 w-px bg-border" />
          <Button
            type="button"
            size="sm"
            variant={chainModeOn ? "default" : "outline"}
            onClick={() => setChainModeOn((v) => !v)}
            title="Tap to add each point without holding Ctrl -- useful on a tablet"
          >
            <Link2 className="h-3.5 w-3.5" /> Chain mode
          </Button>
          {drawPoints.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={undoLastPoint}>
              <Undo2 className="h-3.5 w-3.5" /> Undo point
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            <Eraser className="h-3.5 w-3.5" /> Clear all
          </Button>
          <div className="mx-2 h-5 w-px bg-border" />
          <Button type="button" size="sm" variant="outline" onClick={savePageAsImage} title="Save this page, as currently shown, as a PNG">
            <ImageDown className="h-3.5 w-3.5" /> Save page as image
          </Button>
        </div>

        <ScaleControls
          scaleRatioLabel={scaleRatioLabel}
          presets={presets}
          calibrating={calibrating}
          onApplyRatio={handleApplyRatio}
          onStartCalibration={() => {
            setCalibrating(true);
            setCalibrationPoints([]);
            setDrawPoints([]);
          }}
          onCancelCalibration={() => {
            setCalibrating(false);
            setCalibrationPoints([]);
          }}
          onSaveCustomPreset={handleSaveCustomPreset}
        />

        {calibrationPrompt && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-plum bg-brand-plum-soft p-2.5 text-sm">
            <span>Real length of that line, in metres:</span>
            <Input type="number" step="0.01" min="0" value={calibrationMetres} onChange={(e) => setCalibrationMetres(e.target.value)} className="h-8 w-24" autoFocus />
            <Button type="button" size="sm" onClick={applyCalibration}>Set scale</Button>
          </div>
        )}

        {message && <p className="text-sm text-destructive">{message}</p>}
        {!selectedItemId && items.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600"><MousePointer2 className="h-3.5 w-3.5" /> Select an item in the panel before measuring.</p>
        )}

        {pdfError ? (
          <p className="text-sm text-destructive">Could not load this plan: {pdfError}</p>
        ) : !pdfDoc ? (
          <p className="text-sm text-muted-foreground">Loading plan…</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border bg-white">
            <div ref={overlayRef} className="relative inline-block" style={{ width: viewportSize.width, height: viewportSize.height }}>
              <canvas ref={canvasRef} />
              <svg
                ref={svgRef}
                width={viewportSize.width}
                height={viewportSize.height}
                className="absolute inset-0 cursor-crosshair"
                onClick={handleOverlayClick}
                onDoubleClick={handleOverlayDoubleClick}
                onMouseMove={handleOverlayMouseMove}
              >
                {pageMeasurements.map((m) => {
                  const screenPts = m.points.map(pointToScreen);
                  const isSelected = selectedMeasurement?.measurementId === m.id;
                  const midpoint = screenPts[Math.floor(screenPts.length / 2)];
                  return (
                    <g key={m.id} onClick={(e) => { e.stopPropagation(); selectMeasurement(m.itemId, m.id, m.label); }}>
                      <polyline
                        points={screenPts.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={m.colour}
                        strokeWidth={isSelected ? 4 : 2.5}
                        strokeDasharray={isSelected ? "6 3" : undefined}
                      />
                      {screenPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={m.colour} />)}
                      <text x={midpoint.x} y={midpoint.y - 6} fontSize={11} fill={m.colour} fontWeight={600} style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>
                        {Number(m.computedMetres)}m{m.label ? ` — ${m.label}` : ""}
                      </text>
                    </g>
                  );
                })}

                {drawPoints.length > 0 && (() => {
                  const screenPts = drawPoints.map(pointToScreen);
                  const previewPts = hoverPoint ? [...screenPts, pointToScreen(hoverPoint)] : screenPts;
                  const activeItem = items.find((i) => i.id === selectedItemId);
                  return (
                    <g>
                      <polyline points={previewPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={activeItem?.colour ?? "#3C2263"} strokeWidth={2} strokeDasharray="5 4" />
                      {screenPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={activeItem?.colour ?? "#3C2263"} />)}
                    </g>
                  );
                })()}

                {calibrationPoints.map((p, i) => {
                  const sp = pointToScreen(p);
                  return <circle key={i} cx={sp.x} cy={sp.y} r={4} fill="#B91C1C" />;
                })}
                {calibrationPoints.length === 1 && hoverPoint && (
                  <line x1={pointToScreen(calibrationPoints[0]).x} y1={pointToScreen(calibrationPoints[0]).y} x2={pointToScreen(hoverPoint).x} y2={pointToScreen(hoverPoint).y} stroke="#B91C1C" strokeWidth={2} strokeDasharray="4 4" />
                )}
              </svg>
            </div>
          </div>
        )}

        {selectedMeasurement && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-sm">
            <span className="text-muted-foreground">Label:</span>
            <Input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} className="h-8 w-56" placeholder="e.g. bathroom 104 perimeter" />
            <Button type="button" size="sm" onClick={saveLabel}>Save</Button>
            <Button type="button" size="sm" variant="destructive" onClick={deleteSelectedMeasurement}>Delete</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedMeasurement(null)}>Close</Button>
          </div>
        )}

        <OutputActions takeoffId={takeoff.id} items={items} grandTotalGbp={grandTotalGbp} />
      </div>

      <div className="space-y-3">
        <ItemsPanel
          items={items}
          rateCardItems={rateCardItems}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onCreateItem={handleCreateItem}
          onUpdateItemRate={handleUpdateItemRate}
          onDeleteItem={handleDeleteItem}
          onAddAllFromRateCard={handleAddAllFromRateCard}
          onSaveItemToRateCard={handleSaveItemToRateCard}
          totalMetres={totalMetres}
          grandTotalGbp={grandTotalGbp}
        />

        <div className="space-y-1.5 rounded-lg border bg-card p-3 text-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company</h2>
          <Select
            value={takeoff.customerId ?? ""}
            onChange={async (e) => {
              await updateTakeoffDetailsAction(takeoff.id, { customerId: e.target.value || null });
            }}
            className="h-9 text-sm"
          >
            <option value="">Not yet linked</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
          </Select>
          <p className="text-xs text-muted-foreground">Filed under this company&apos;s Documents once set.</p>
        </div>
      </div>
    </div>
  );
}
