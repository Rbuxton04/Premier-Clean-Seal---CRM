"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2, Eraser, MousePointer2, ImageDown } from "lucide-react";
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
  createTakeoffFileAction, renameTakeoffFileAction, moveTakeoffFileAction, removeTakeoffFileAction, countMeasurementsOnFileAction,
} from "../actions";
import { ItemsPanel } from "./items-panel";
import { ScaleControls } from "./scale-controls";
import { OutputActions } from "./output-actions";
import { TopBar } from "./workspace/top-bar";
import { ToolPalette } from "./workspace/tool-palette";
import { StatusBar } from "./workspace/status-bar";
import { WorkspaceTray } from "./workspace/workspace-tray";
import { MobileWorkspaceBar } from "./workspace/mobile-workspace-bar";
import { PagesPanel } from "./workspace/pages-panel";
import { useWorkspaceLayout, type PanelId } from "./workspace/use-workspace-layout";
import type { ActiveTool } from "./workspace/types";

type CustomerOption = { id: string; name: string; company: string | null };

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

const PANEL_TITLES: Record<PanelId, string> = {
  items: "Items & Totals",
  scale: "Scale",
  pages: "Pages",
  search: "Search",
  selected: "Selected",
  output: "Output",
};

export function MeasureTool({
  takeoff, presets, customers, rateCardItems,
}: { takeoff: TakeoffDetail; presets: ScalePresetItem[]; customers: CustomerOption[]; rateCardItems: RateCardItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const workspace = useWorkspaceLayout();
  const [fullScreen, setFullScreen] = useState(false);
  const [drawingName, setDrawingName] = useState(takeoff.name);

  // Files (Drawings Part 1 Step 4) -- a drawing can hold several PDFs,
  // shown as tabs. Every pre-existing takeoff was backfilled to have
  // exactly one by the migration, and createTakeoff now always creates
  // one too, so files[0] should always exist in practice.
  const [files, setFiles] = useState<TakeoffDetail["files"]>(takeoff.files);
  const [activeFileId, setActiveFileId] = useState<string>(takeoff.files[0]?.id ?? "");
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

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
  // Additional view-only rotation on top of the page's own /Rotate, applied
  // via pdf.js's own rotation parameter rather than a CSS transform -- see
  // the comment on screenToPoint/pointToScreen below for why.
  const [viewRotation, setViewRotation] = useState<0 | 90 | 180 | 270>(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pdfError, setPdfError] = useState<string | null>(null);
  // The two viewports behind screenToPoint/pointToScreen -- see renderPage().
  const baseViewportRef = useRef<import("pdfjs-dist").PageViewport | null>(null);
  const displayViewportRef = useRef<import("pdfjs-dist").PageViewport | null>(null);
  const zoomAnchorRef = useRef<{ pointX: number; pointY: number; cursorX: number; cursorY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);
  const panMovedRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const [pointsPerMetre, setPointsPerMetre] = useState(takeoff.pointsPerMetre);
  const [scaleRatioLabel, setScaleRatioLabel] = useState(takeoff.scaleRatioLabel);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const calibrating = activeTool === "calibrate";
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationPrompt, setCalibrationPrompt] = useState<{ screenPixels: number } | null>(null);
  const [calibrationMetres, setCalibrationMetres] = useState("");

  const [items, setItems] = useState<TakeoffItemDetail[]>(takeoff.items);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(takeoff.items[0]?.id ?? null);

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
    if (!activeFileId) return;
    ensurePdfWorkerConfigured();
    let cancelled = false;
    setPdfError(null);
    setPdfDoc(null);
    setCurrentPage(1);
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const doc = await pdfjsLib.getDocument({
          url: `/api/takeoffs/${takeoff.id}/file?fileId=${activeFileId}`,
          disableRange: true,
          disableStream: true,
        }).promise;
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
  }, [takeoff.id, activeFileId]);

  // --- Render the current page at the current zoom/rotation --------------
  // Renders onto a CANVAS CAPPED AT A MAXIMUM PIXEL AREA -- an oversized
  // architectural sheet at a high zoom could otherwise ask the browser for
  // a multi-hundred-megabyte canvas, which can crash the tab outright on
  // some devices. When the requested size would exceed that cap, this
  // clamps the EFFECTIVE render scale (not the zoom percentage shown in the
  // UI, which still reflects what the user asked for) and surfaces a short
  // message instead of silently drawing at an unexpectedly lower quality.
  const MAX_CANVAS_PIXELS = 16_000_000; // ~4000x4000 -- comfortably under every mainstream browser's canvas size limit
  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!pdfDoc || !canvas) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const effectiveRotation = ((page.rotate + viewRotation) % 360 + 360) % 360;
      // Fixed at scale 1 -- this (page.rotate, scale 1) space is exactly
      // what every stored TakeoffMeasurement.points value is in (see the
      // scale-math comment in validators/takeoff.ts), independent of
      // render zoom. Using renderScale here instead would silently scale
      // every stored point by the CURRENT zoom on every conversion --
      // reopening the same drawing at a different zoom would then show
      // measurements in the wrong place entirely. This is the one
      // invariant the whole points-space design depends on.
      const baseViewport = page.getViewport({ scale: 1 });
      let displayViewport = page.getViewport({ scale: renderScale, rotation: effectiveRotation });

      if (displayViewport.width * displayViewport.height > MAX_CANVAS_PIXELS) {
        const cappedScale = renderScale * Math.sqrt(MAX_CANVAS_PIXELS / (displayViewport.width * displayViewport.height));
        displayViewport = page.getViewport({ scale: cappedScale, rotation: effectiveRotation });
        setMessage("This page is too large to render at full quality at this zoom -- showing it at a reduced resolution.");
      }

      baseViewportRef.current = baseViewport;
      displayViewportRef.current = displayViewport;
      canvas.width = displayViewport.width;
      canvas.height = displayViewport.height;
      setViewportSize({ width: displayViewport.width, height: displayViewport.height });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: displayViewport }).promise;
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Could not render this page.");
    }
  }, [pdfDoc, currentPage, renderScale, viewRotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Restores the page-point that was under the cursor before a zoom-at-
  // cursor wheel event, once the canvas has actually re-rendered at the new
  // scale (viewportSize only updates after that render completes).
  useEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = viewerContainerRef.current;
    if (!anchor || !container) return;
    container.scrollLeft = anchor.pointX * renderScale - anchor.cursorX;
    container.scrollTop = anchor.pointY * renderScale - anchor.cursorY;
    zoomAnchorRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize]);

  // Zoom at the cursor on Ctrl+wheel or a trackpad pinch (Chrome/Firefox
  // report pinch-zoom as a wheel event with ctrlKey set) -- a NATIVE,
  // non-passive listener, since React's onWheel is attached passively and
  // silently can't preventDefault the page from scrolling underneath. A
  // plain wheel (no Ctrl) is left alone to scroll/pan the container
  // natively, matching the Figma/Google Maps convention the brief's
  // phrasing implies.
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setRenderScale((z) => {
        const pointX = (container!.scrollLeft + cursorX) / z;
        const pointY = (container!.scrollTop + cursorY) / z;
        zoomAnchorRef.current = { pointX, pointY, cursorX, cursorY };
        const next = z * (1 - e.deltaY * 0.0015);
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +next.toFixed(3)));
      });
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // --- Keyboard: Escape cancels a draw/calibration, Enter finishes a chain,
  // S/L/C/K pick a tool (SketchUp-style single-select tool palette) -------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = Boolean(target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (e.key === "Escape") {
        setDrawPoints([]);
        setCalibrationPoints([]);
        setActiveTool((t) => (t === "calibrate" ? "select" : t));
      } else if (e.key === "Enter" && drawIsChain && drawPoints.length >= 2) {
        finalizeMeasurement(drawPoints, "CHAIN");
      } else if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "s") setActiveTool("select");
        else if (key === "l") setActiveTool("length");
        else if (key === "c") setActiveTool("chain");
        else if (key === "k") setActiveTool("calibrate");
        else if (key === "1") fitPage();
        else if (key === "2") fitWidth();
        else if (key === "r") rotateView();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawPoints, drawIsChain]);

  // --- Keyboard: holding Space pans with any tool (a separate effect since
  // this needs keyup too, unlike the shortcuts above) ----------------------
  useEffect(() => {
    function isTypingTarget(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      return Boolean(target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !isTypingTarget(e)) {
        e.preventDefault(); // stop the page itself from scrolling on Space
        setSpaceHeld(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  /**
   * Converts a click into the STORED point space -- which stays relative
   * to the page's own native rotation regardless of any view rotation the
   * user has applied (the brief's "stored points stay in unrotated page-
   * point space; convert for display and input"). Goes through pdf.js's
   * own PageViewport conversions for both the current (possibly rotated)
   * display viewport and the unrotated base viewport, the same technique
   * proven in src/lib/pdf/takeoff-markup-transform.ts for the server-side
   * export -- rather than deriving a rotation matrix by hand twice.
   */
  function screenToPoint(clientX: number, clientY: number): Point {
    const rect = overlayRef.current!.getBoundingClientRect();
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    const dv = displayViewportRef.current;
    const bv = baseViewportRef.current;
    if (!dv || !bv) return { x: displayX / renderScale, y: displayY / renderScale };
    const [pdfX, pdfY] = dv.convertToPdfPoint(displayX, displayY);
    const [x, y] = bv.convertToViewportPoint(pdfX, pdfY);
    return { x, y };
  }

  /** The inverse of screenToPoint -- a stored (unrotated) point to where it should be drawn on the current, possibly rotated, display. */
  function pointToScreen(p: Point): Point {
    const dv = displayViewportRef.current;
    const bv = baseViewportRef.current;
    if (!dv || !bv) return { x: p.x * renderScale, y: p.y * renderScale };
    const [pdfX, pdfY] = bv.convertToPdfPoint(p.x, p.y);
    const [x, y] = dv.convertToViewportPoint(pdfX, pdfY);
    return { x, y };
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
    setActiveTool("select");
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
      { takeoffItemId: selectedItemId, pageNumber: currentPage, takeoffFileId: activeFileId || undefined, type, points },
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
              measurements: [...it.measurements, { id: result.data.id, pageNumber: currentPage, takeoffFileId: activeFileId || null, type, points, computedMetres: result.data.computedMetres, label: null }],
              totalMetres: +(it.totalMetres + result.data.computedMetres).toFixed(2),
              lineTotalGbp: +((it.totalMetres + result.data.computedMetres) * Number(it.pricePerMetre)).toFixed(2),
            }
          : it
      )
    );
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.detail > 1) return; // double-click is handled separately, below
    if (panMovedRef.current) {
      panMovedRef.current = false; // a real pan drag just ended under this click -- don't also treat it as a measurement click
      return;
    }
    if (activeTool === "calibrate") {
      handleCalibrationClick(e);
      return;
    }
    if (activeTool === "select") return; // Select/Pan: a plain click does nothing, panning is a drag (below)
    if (!selectedItemId) {
      setMessage("Select or add an item before measuring.");
      return;
    }
    const p = screenToPoint(e.clientX, e.clientY);
    const wantsChain = activeTool === "chain";

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

  // --- Pan: Select/Pan tool, Space held with any tool, or middle-mouse,
  // from any tool. Scrolls the viewer's native container directly rather
  // than a custom transform -- screenToPoint/pointToScreen already read
  // the overlay's live getBoundingClientRect(), so they stay correct at
  // any scroll position with no extra code. Two-finger drag on touch pans
  // via the browser's own native touch-scrolling of the same container.
  function wantsPan(e: React.PointerEvent): boolean {
    return activeTool === "select" || spaceHeld || e.button === 1;
  }

  function handleOverlayPointerDown(e: React.PointerEvent) {
    if (!wantsPan(e)) return;
    const container = viewerContainerRef.current;
    if (!container) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, startScrollLeft: container.scrollLeft, startScrollTop: container.scrollTop };
    panMovedRef.current = false;
  }

  function handleOverlayPointerMove(e: React.PointerEvent) {
    const pan = panRef.current;
    const container = viewerContainerRef.current;
    if (pan && container) {
      const dx = e.clientX - pan.startX;
      const dy = e.clientY - pan.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMovedRef.current = true;
      container.scrollLeft = pan.startScrollLeft - dx;
      container.scrollTop = pan.startScrollTop - dy;
      return;
    }
    handleOverlayMouseMove(e);
  }

  function handleOverlayPointerUp() {
    panRef.current = null;
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

  async function handleRename(newName: string) {
    setDrawingName(newName);
    const result = await updateTakeoffDetailsAction(takeoff.id, { name: newName });
    if (!result.ok) {
      setMessage(result.message);
      setDrawingName(takeoff.name);
    }
  }

  // --- Files (Drawings Part 1 Step 4) -------------------------------------
  async function handleAddFile(file: File) {
    setFileMessage(null);
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "application/pdf" }),
      });
      const presign = await presignRes.json();
      if (!presign.configured) {
        setFileMessage("Storage isn't connected yet.");
        return;
      }
      await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/pdf" }, body: file });
      const result = await createTakeoffFileAction(takeoff.id, { name: file.name.replace(/\.pdf$/i, ""), fileUrl: presign.path });
      if (!result.ok) {
        setFileMessage(result.message);
        return;
      }
      const newFile = { id: result.data.id, name: file.name.replace(/\.pdf$/i, ""), pageCount: null, pointsPerMetre: null, sortOrder: files.length };
      setFiles((cur) => [...cur, newFile]);
      setActiveFileId(newFile.id);
    } catch {
      setFileMessage("Upload failed -- please try again.");
    }
  }

  async function handleRenameFile(fileId: string, name: string) {
    setFiles((cur) => cur.map((f) => (f.id === fileId ? { ...f, name } : f)));
    const result = await renameTakeoffFileAction(takeoff.id, fileId, { name });
    if (!result.ok) setFileMessage(result.message);
  }

  async function handleMoveFile(fileId: string, direction: "up" | "down") {
    const index = files.findIndex((f) => f.id === fileId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= files.length) return;
    const next = [...files];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setFiles(next);
    await moveTakeoffFileAction(takeoff.id, fileId, direction);
  }

  async function handleRemoveFile(fileId: string) {
    if (files.length <= 1) {
      setFileMessage("A drawing needs at least one file.");
      return;
    }
    const countResult = await countMeasurementsOnFileAction(takeoff.id, fileId);
    const count = countResult.ok ? countResult.data.count : 0;
    const file = files.find((f) => f.id === fileId);
    const confirmMessage =
      count > 0
        ? `Remove "${file?.name}"? ${count} measurement${count === 1 ? "" : "s"} on it will stay recorded but hidden until it's restored.`
        : `Remove "${file?.name}"?`;
    if (!window.confirm(confirmMessage)) return;

    const result = await removeTakeoffFileAction(takeoff.id, fileId);
    if (!result.ok) {
      setFileMessage(result.message);
      return;
    }
    setFiles((cur) => cur.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) setActiveFileId(files.find((f) => f.id !== fileId)?.id ?? "");
  }

  /** The page's own (scale=1) size, derived from the last render rather than re-fetched -- viewportSize/renderScale is always that page's size at the CURRENT zoom. */
  function naturalPageSize(): { width: number; height: number } | null {
    if (!viewportSize.width || !viewportSize.height || !renderScale) return null;
    return { width: viewportSize.width / renderScale, height: viewportSize.height / renderScale };
  }

  function fitPage() {
    const container = viewerContainerRef.current;
    const natural = naturalPageSize();
    if (!container || !natural) return;
    const scale = Math.min(container.clientWidth / natural.width, container.clientHeight / natural.height);
    setRenderScale(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)));
  }

  function fitWidth() {
    const container = viewerContainerRef.current;
    const natural = naturalPageSize();
    if (!container || !natural) return;
    setRenderScale(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, container.clientWidth / natural.width)));
  }

  /** View-only -- stored measurement points never change; pointToScreen/screenToPoint convert through pdf.js's own viewport math for whatever rotation is currently applied (see those functions' comments). */
  function rotateView() {
    setViewRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270);
  }

  const totalMetres = +items.reduce((sum, i) => sum + i.totalMetres, 0).toFixed(2);
  const grandTotalGbp = +items.reduce((sum, i) => sum + i.lineTotalGbp, 0).toFixed(2);
  // A null takeoffFileId means "the first file" (the backfill/safety-net
  // convention) -- matching on that here is essential once a drawing has
  // more than one file, since different files can share the same
  // pageNumber (page 1 of file A is a different physical page from page 1
  // of file B) -- without this filter, switching tabs would show the
  // other file's measurements overlaid on the wrong plan.
  const firstFileId = files[0]?.id;
  const pageMeasurements = items.flatMap((it) =>
    it.measurements
      .filter((m) => m.pageNumber === currentPage && (m.takeoffFileId ?? firstFileId) === activeFileId)
      .map((m) => ({ ...m, colour: it.colour, itemId: it.id }))
  );
  const drawingMetres = drawPoints.length > 0 ? chainLengthPoints(hoverPoint ? [...drawPoints, hoverPoint] : drawPoints) / pointsPerMetre : null;

  const panelContent: Record<PanelId, React.ReactNode> = {
    items: (
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
    ),
    scale: (
      <div className="space-y-2">
        <ScaleControls
          scaleRatioLabel={scaleRatioLabel}
          presets={presets}
          calibrating={calibrating}
          onApplyRatio={handleApplyRatio}
          onStartCalibration={() => {
            setActiveTool("calibrate");
            setCalibrationPoints([]);
            setDrawPoints([]);
          }}
          onCancelCalibration={() => {
            setActiveTool("select");
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
      </div>
    ),
    pages: (
      <PagesPanel
        pdfDoc={pdfDoc}
        numPages={numPages}
        currentPage={currentPage}
        onJump={setCurrentPage}
        items={items}
        activeFileId={activeFileId}
        firstFileId={firstFileId}
      />
    ),
    search: <p className="text-xs text-muted-foreground">Search isn&apos;t available yet -- coming in a later update.</p>,
    selected: selectedMeasurement ? (
      <div className="space-y-2 text-sm">
        <span className="text-xs text-muted-foreground">Label</span>
        <Input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} className="h-8 w-full" placeholder="e.g. bathroom 104 perimeter" />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={saveLabel}>Save</Button>
          <Button type="button" size="sm" variant="destructive" onClick={deleteSelectedMeasurement}>Delete</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedMeasurement(null)}>Close</Button>
        </div>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">Click a measurement on the plan to select it.</p>
    ),
    output: (
      <div className="space-y-2">
        <OutputActions takeoffId={takeoff.id} items={items} grandTotalGbp={grandTotalGbp} />
        <div className="space-y-1.5 border-t pt-2 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</h3>
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
    ),
  };

  return (
    <div className={fullScreen ? "fixed inset-0 z-40 flex flex-col gap-2 overflow-auto bg-background p-3" : "flex flex-col gap-2"}>
      <input
        ref={fileUploadInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAddFile(f);
          e.target.value = "";
        }}
      />
      {fileMessage && <p className="text-sm text-destructive">{fileMessage}</p>}
      <TopBar
        name={drawingName}
        onRename={handleRename}
        files={files}
        activeFileId={activeFileId}
        onSelectFile={setActiveFileId}
        onAddFile={() => fileUploadInputRef.current?.click()}
        onRenameFile={handleRenameFile}
        onMoveFile={handleMoveFile}
        onRemoveFile={handleRemoveFile}
        currentPage={currentPage}
        numPages={numPages}
        onPrevPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
        zoomPercent={renderScale * 100}
        onZoomIn={() => setRenderScale((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
        onZoomOut={() => setRenderScale((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
        onFitPage={fitPage}
        onFitWidth={fitWidth}
        onRotate={rotateView}
        fullScreen={fullScreen}
        onToggleFullScreen={() => setFullScreen((v) => !v)}
      />

      <div className="flex flex-1 gap-2 overflow-hidden pb-14 lg:pb-0">
        <div className="hidden lg:block">
          <ToolPalette activeTool={activeTool} onSelectTool={setActiveTool} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {message && <p className="text-sm text-destructive">{message}</p>}
          {activeTool !== "select" && !selectedItemId && items.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600"><MousePointer2 className="h-3.5 w-3.5" /> Select an item in the Items &amp; Totals panel before measuring.</p>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-1.5">
            {drawPoints.length > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={undoLastPoint}>
                <Undo2 className="h-3.5 w-3.5" /> Undo point
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              <Eraser className="h-3.5 w-3.5" /> Clear all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={savePageAsImage} title="Save this page, as currently shown, as a PNG">
              <ImageDown className="h-3.5 w-3.5" /> Save page as image
            </Button>
          </div>

          {pdfError ? (
            <p className="text-sm text-destructive">Could not load this plan: {pdfError}</p>
          ) : !pdfDoc ? (
            <p className="text-sm text-muted-foreground">Loading plan…</p>
          ) : (
            <div ref={viewerContainerRef} className="flex-1 overflow-auto rounded-lg border bg-white">
              <div ref={overlayRef} className="relative inline-block" style={{ width: viewportSize.width, height: viewportSize.height }}>
                <canvas ref={canvasRef} />
                <svg
                  ref={svgRef}
                  width={viewportSize.width}
                  height={viewportSize.height}
                  className={activeTool === "select" || spaceHeld ? "absolute inset-0 cursor-grab active:cursor-grabbing" : "absolute inset-0 cursor-crosshair"}
                  onClick={handleOverlayClick}
                  onDoubleClick={handleOverlayDoubleClick}
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={handleOverlayPointerMove}
                  onPointerUp={handleOverlayPointerUp}
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

          <StatusBar
            activeTool={activeTool}
            drawingMetres={drawingMetres}
            scaleLabel={scaleRatioLabel ?? "Calibrated"}
            cursor={hoverPoint}
            zoomPercent={renderScale * 100}
          />
        </div>

        <div className="hidden lg:flex">
          <WorkspaceTray
            layout={workspace.layout}
            onToggleCollapsed={workspace.toggleCollapsed}
            onPopOut={(id) => workspace.setFloating(id, true)}
            onDock={(id) => workspace.setFloating(id, false)}
            onMove={workspace.moveFloating}
            onReorder={workspace.reorder}
            onToggleTrayCollapsed={() => workspace.setTrayCollapsed(!workspace.layout.trayCollapsed)}
            onResizeTray={workspace.setTrayWidth}
            onResetLayout={workspace.reset}
            panelTitles={PANEL_TITLES}
            panelContent={panelContent}
          />
        </div>
      </div>

      <div className="lg:hidden">
        <MobileWorkspaceBar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          layout={workspace.layout}
          onToggleCollapsed={workspace.toggleCollapsed}
          panelTitles={PANEL_TITLES}
          panelContent={panelContent}
        />
      </div>
    </div>
  );
}
