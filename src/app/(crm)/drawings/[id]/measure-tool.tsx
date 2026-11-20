"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Undo2, Redo2, Eraser, MousePointer2, ImageDown, Magnet, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ensurePdfWorkerConfigured } from "../pdf-worker-setup";
import type { TakeoffDetail, TakeoffItemDetail, TakeoffMeasurementItem } from "@/services/takeoff.service";
import type { ScalePresetItem } from "@/services/scale-preset.service";
import type { RateCardItem } from "@/services/takeoff-rate-card.service";
import { chainLengthPoints, resolvePointsPerMetre, computeMeasurementMetres, snapPointToAngle, type Point, type MaterialDefaultsValues } from "@/validators/takeoff";
import {
  createMeasurementAction, updateMeasurementLabelAction, deleteMeasurementAction, clearAllMeasurementsAction,
  createTakeoffItemAction, updateTakeoffItemAction, deleteTakeoffItemAction,
  updateTakeoffScaleAction, updateTakeoffDetailsAction, createScalePresetAction,
  addAllFromRateCardAction, saveItemAsPresetAction,
  createTakeoffFileAction, renameTakeoffFileAction, moveTakeoffFileAction, removeTakeoffFileAction, countMeasurementsOnFileAction,
  createTakeoffNoteAction, updateTakeoffNoteAction, deleteTakeoffNoteAction, restoreTakeoffNoteAction,
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
import { SearchPanel, type SearchResult } from "./workspace/search-panel";
import { MaterialsPanel } from "./workspace/materials-panel";
import { MeasurementsListPanel, type MeasurementRow } from "./workspace/measurements-list-panel";
import { useWorkspaceLayout, type PanelId } from "./workspace/use-workspace-layout";
import type { ActiveTool } from "./workspace/types";
import { extractLineSegments } from "@/lib/pdf/takeoff-vector-extraction";
import { buildSpatialIndex, findSnap, type SpatialIndex, type SnapResult } from "@/lib/pdf/takeoff-snap";

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
  measurements: "Measurements",
  materials: "Materials",
  output: "Output",
};

export function MeasureTool({
  takeoff, presets, customers, rateCardItems, materialDefaults,
}: {
  takeoff: TakeoffDetail; presets: ScalePresetItem[]; customers: CustomerOption[]; rateCardItems: RateCardItem[];
  materialDefaults: MaterialDefaultsValues;
}) {
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

  // --- Search (Drawings Part 1 Step 5) -------------------------------------
  // Indexed lazily (only once a search actually runs, never on panel open)
  // and cached per file for the rest of the session -- a plain ref, not
  // React state, since the cache itself never needs to trigger a re-render.
  const searchIndexRef = useRef<Map<string, { pageNumber: number; items: { text: string; minX: number; minY: number; maxX: number; maxY: number }[] }[]>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [noSearchableText, setNoSearchableText] = useState(false);
  const [highlightActive, setHighlightActive] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [shiftHeld, setShiftHeld] = useState(false);

  // --- Snap to drawing lines and corners (Drawings Part 2, section 1) ----
  // Cached per file+page, built lazily the first time that page is shown
  // (or re-shown after being toggled on), never on pages that turn out to
  // have no vectors at all (a scanned/image-only PDF) -- see
  // ensurePageSnapIndexed below.
  const snapIndexRef = useRef<Map<string, { index: SpatialIndex | null; noVectors: boolean }>>(new Map());
  const SNAP_RADIUS_SCREEN_PX = 12;
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapNoVectors, setSnapNoVectors] = useState(false);
  const [hoverSnapType, setHoverSnapType] = useState<SnapResult["type"] | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("drawings-snap-enabled");
      if (stored !== null) setSnapEnabled(stored === "1");
    } catch {
      // Storage unavailable -- snapping just defaults to on for this session.
    }
  }, []);
  function toggleSnap() {
    setSnapEnabled((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("drawings-snap-enabled", next ? "1" : "0");
      } catch {
        // Not fatal -- the toggle still works for this session.
      }
      return next;
    });
  }

  // --- Magnifier loupe + shortcuts cheat sheet (Drawings Part 2, section 7) ---
  const [magnifierEnabled, setMagnifierEnabled] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState<{ clientX: number; clientY: number; canvasX: number; canvasY: number } | null>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [pointsPerMetre, setPointsPerMetre] = useState(takeoff.pointsPerMetre);
  const [scaleRatioLabel, setScaleRatioLabel] = useState(takeoff.scaleRatioLabel);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const calibrating = activeTool === "calibrate";
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationPrompt, setCalibrationPrompt] = useState<{ screenPixels: number } | null>(null);
  const [calibrationMetres, setCalibrationMetres] = useState("");

  const [items, setItems] = useState<TakeoffItemDetail[]>(takeoff.items);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(takeoff.items[0]?.id ?? null);
  // Mirrors items/notes for undo/redo closures that may fire long after
  // the render that created them -- reading items/notes directly there
  // would close over a stale snapshot.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [drawIsChain, setDrawIsChain] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<{ itemId: string; measurementId: string } | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // --- Undo/redo (Drawings Part 2, section 7) -- a real stack of every
  // reversible edit (section 5 started this as a single-slot "undo the
  // last thing" toast; this generalises the same mechanism). Entries live
  // in refs, not state, since they hold closures over server actions, not
  // serialisable data; historyVersion just forces a re-render so the
  // toolbar's Undo/Redo buttons can reflect whether either stack is
  // non-empty. A fresh user action always clears the redo stack.
  type HistoryEntry = { label: string; undo: () => Promise<void>; redo: () => Promise<void> };
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const [, setHistoryVersion] = useState(0);
  const [toast, setToast] = useState<{ text: string; action: "undo" | "redo" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(text: string, action: "undo" | "redo") {
    setToast({ text, action });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  }

  function pushHistory(entry: HistoryEntry) {
    undoStackRef.current.push(entry);
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
    showToast(entry.label, "undo");
  }

  async function performUndo() {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(entry);
    setHistoryVersion((v) => v + 1);
    await entry.undo();
    showToast(`Undid: ${entry.label}`, "redo");
  }

  async function performRedo() {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(entry);
    setHistoryVersion((v) => v + 1);
    await entry.redo();
    showToast(`Redid: ${entry.label}`, "undo");
  }

  // --- Notes (Drawings Part 2) -- pins on the plan, independent of items ---
  const [notes, setNotes] = useState<TakeoffDetail["notes"]>(takeoff.notes);
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteTextDraft, setNoteTextDraft] = useState("");
  const noteDragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const noteDraggedRef = useRef(false);

  // --- Show/hide per item (Drawings Part 2, section 5) -- a view
  // preference only, persisted per drawing in localStorage; never touches
  // totals, quotes or exports (see the comment on pageMeasurements below). --
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set());
  const hiddenItemsStorageKey = `drawing-hidden-items-${takeoff.id}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(hiddenItemsStorageKey);
      if (raw) setHiddenItemIds(new Set(JSON.parse(raw)));
    } catch {
      // Storage unavailable/blocked -- everything just starts visible.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeoff.id]);

  function persistHiddenItems(next: Set<string>) {
    setHiddenItemIds(next);
    try {
      window.localStorage.setItem(hiddenItemsStorageKey, JSON.stringify(Array.from(next)));
    } catch {
      // Not fatal -- the session still works, it just won't remember next time.
    }
  }
  function toggleItemVisibility(itemId: string) {
    const next = new Set(hiddenItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    persistHiddenItems(next);
  }
  function showAllItems() {
    persistHiddenItems(new Set());
  }
  function hideAllItems() {
    persistHiddenItems(new Set(items.map((it) => it.id)));
  }

  // --- Measurements list (Drawings Part 2, section 5) -- hover highlight
  // and "centre it on jump" support ------------------------------------
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const pendingCenterRef = useRef<Point | null>(null);
  useEffect(() => {
    const container = viewerContainerRef.current;
    const target = pendingCenterRef.current;
    if (!container || !target) return;
    const screen = pointToScreen(target);
    container.scrollLeft = screen.x - container.clientWidth / 2;
    container.scrollTop = screen.y - container.clientHeight / 2;
    pendingCenterRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize]);

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

  // Magnifier loupe (Drawings Part 2, section 7): redraws a zoomed crop of
  // the already-rendered main canvas centred on the cursor -- re-reads the
  // canvas's own pixels rather than re-rendering the PDF page, so it's
  // cheap enough to run on every mouse move.
  const MAGNIFIER_SIZE = 160;
  const MAGNIFIER_ZOOM = 3;
  useEffect(() => {
    if (!magnifierEnabled || !magnifierPos) return;
    const src = canvasRef.current;
    const dst = magnifierCanvasRef.current;
    if (!src || !dst) return;
    const ctx = dst.getContext("2d");
    if (!ctx) return;
    const srcSize = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
    ctx.imageSmoothingEnabled = false; // a crisp pixel zoom, not a blurred one
    ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    ctx.drawImage(src, magnifierPos.canvasX - srcSize / 2, magnifierPos.canvasY - srcSize / 2, srcSize, srcSize, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
  }, [magnifierEnabled, magnifierPos]);

  /**
   * Extracts this page's vector line segments and builds its spatial
   * index, once, the first time it's shown (or shown again after a
   * previous attempt found no vectors at all -- see the scanned-PDF note
   * below, which is cached as noVectors so this doesn't re-extract every
   * time the same scanned page is revisited). Segments come back from
   * extractLineSegments in raw PDF user space; each one is converted to
   * the same baseline device space every stored measurement point is in,
   * via the SAME baseViewport.convertToViewportPoint() technique used
   * everywhere else in this file, so a snap target and a clicked point
   * are always compared in the same space.
   */
  async function ensurePageSnapIndexed() {
    if (!pdfDoc || !activeFileId) return;
    const key = `${activeFileId}:${currentPage}`;
    if (snapIndexRef.current.has(key)) {
      setSnapNoVectors(Boolean(snapIndexRef.current.get(key)?.noVectors));
      return;
    }
    const startedAt = performance.now();
    try {
      const page = await pdfDoc.getPage(currentPage);
      const baseViewport = page.getViewport({ scale: 1 });
      const opList = await page.getOperatorList();
      const { segments } = extractLineSegments(opList.fnArray, opList.argsArray as unknown[][]);
      if (segments.length === 0) {
        snapIndexRef.current.set(key, { index: null, noVectors: true });
        setSnapNoVectors(true);
        return;
      }
      const converted = segments.map((s) => {
        const [ax, ay] = baseViewport.convertToViewportPoint(s.a.x, s.a.y);
        const [bx, by] = baseViewport.convertToViewportPoint(s.b.x, s.b.y);
        return { a: { x: ax, y: ay }, b: { x: bx, y: by } };
      });
      const index = buildSpatialIndex(converted, SNAP_RADIUS_SCREEN_PX);
      snapIndexRef.current.set(key, { index, noVectors: false });
      setSnapNoVectors(false);
      // eslint-disable-next-line no-console
      console.log(`[snap] page ${currentPage}: ${segments.length} segments extracted and indexed in ${(performance.now() - startedAt).toFixed(1)}ms`);
    } catch {
      // A page that fails to extract (corrupt content stream, etc.) just
      // behaves as if it had no vectors -- never a thrown error over a
      // feature that's meant to degrade gracefully.
      snapIndexRef.current.set(key, { index: null, noVectors: true });
      setSnapNoVectors(true);
    }
  }

  useEffect(() => {
    ensurePageSnapIndexed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage, activeFileId]);

  /** Converts a screen-pixel snap radius to the fixed baseline-point space the index is built in -- rotation doesn't affect this (it preserves distances), only the current zoom (renderScale) does. */
  function trySnap(rawPoint: Point, altKeyHeld: boolean): { point: Point; type: SnapResult["type"] | null } {
    if (!snapEnabled || altKeyHeld) return { point: rawPoint, type: null };
    const cached = snapIndexRef.current.get(`${activeFileId}:${currentPage}`);
    if (!cached?.index) return { point: rawPoint, type: null };
    const radius = SNAP_RADIUS_SCREEN_PX / renderScale;
    const result = findSnap(rawPoint, cached.index, radius);
    return result ? { point: result.point, type: result.type } : { point: rawPoint, type: null };
  }

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
      } else if (!isTyping && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) performRedo();
        else performUndo();
      } else if (!isTyping && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        performRedo();
      } else if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // V/L/C/N/K/E pick a tool; F/1/2 fit; R rotate; M magnifier; ? help
        // -- see tool-palette.tsx for why V (not S) is select/pan: S is
        // reserved for the Part 2 snap toggle.
        const key = e.key.toLowerCase();
        if (key === "v") setActiveTool("select");
        else if (key === "l") setActiveTool("length");
        else if (key === "c") setActiveTool("count");
        else if (key === "n") setActiveTool("note");
        else if (key === "k") setActiveTool("calibrate");
        else if (key === "e") setActiveTool("erase");
        else if (key === "f" || key === "1") fitPage();
        else if (key === "2") fitWidth();
        else if (key === "r") rotateView();
        else if (key === "s") toggleSnap();
        else if (key === "m") setMagnifierEnabled((v) => !v);
        else if (e.key === "?") setShowShortcuts((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawPoints, drawIsChain]);

  // --- Keyboard: holding Space pans, holding Shift locks the current
  // draw to 0/45/90 degrees -- a separate effect since both need keyup
  // too, unlike the tool shortcuts above --------------------------------
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
      if (e.key === "Shift" && !isTypingTarget(e)) setShiftHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false);
      if (e.key === "Shift") setShiftHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  /**
   * Shift-lock (Drawings Part 2, section 2): constrains the segment from
   * the previous point to the nearest of 0/45/90 degrees (and their
   * mirrors), measured "as viewed" -- i.e. in on-screen display space,
   * which already reflects the current view rotation (Part 1, Step 3) --
   * rather than in the unrotated stored-point space. Works entirely
   * through the same proven pointToScreen/screenToPointFromOverlay
   * conversion everything else on the canvas uses, so it stays correct at
   * any zoom/pan/rotation with no coordinate math of its own beyond the
   * angle snap itself.
   */
  function applyShiftLock(rawPoint: Point, fromPoint: Point): Point {
    const fromScreen = pointToScreen(fromPoint);
    const rawScreen = pointToScreen(rawPoint);
    const snappedScreen = snapPointToAngle(fromScreen, rawScreen);
    return screenToPointFromOverlay(snappedScreen.x, snappedScreen.y);
  }

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
  /** The shared conversion behind screenToPoint/screenToPointFromOverlay -- takes a point already relative to the overlay's own top-left (not raw clientX/Y). */
  function displayPointToStoredPoint(displayX: number, displayY: number): Point {
    const dv = displayViewportRef.current;
    const bv = baseViewportRef.current;
    if (!dv || !bv) return { x: displayX / renderScale, y: displayY / renderScale };
    const [pdfX, pdfY] = dv.convertToPdfPoint(displayX, displayY);
    const [x, y] = bv.convertToViewportPoint(pdfX, pdfY);
    return { x, y };
  }

  function screenToPoint(clientX: number, clientY: number): Point {
    const rect = overlayRef.current!.getBoundingClientRect();
    return displayPointToStoredPoint(clientX - rect.left, clientY - rect.top);
  }

  /** Same conversion, for callers (note-drag) that already have an overlay-relative display point rather than raw clientX/Y. */
  function screenToPointFromOverlay(displayX: number, displayY: number): Point {
    return displayPointToStoredPoint(displayX, displayY);
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
        // A COUNT item's quantity is a marker count, not a distance -- the
        // scale doesn't change it at all.
        if (it.kind === "COUNT") return it;
        const measurements = it.measurements.map((m) => ({ ...m, computedMetres: computeMeasurementMetres(m.points, newPointsPerMetre) }));
        const totalMetres = +measurements.reduce((sum, m) => sum + Number(m.computedMetres), 0).toFixed(2);
        return { ...it, measurements, totalMetres, lineTotalGbp: +(totalMetres * Number(it.pricePerMetre)).toFixed(2) };
      })
    );
  }

  // --- Calibration -------------------------------------------------------
  function handleCalibrationClick(e: React.MouseEvent) {
    const p = trySnap(screenToPoint(e.clientX, e.clientY), e.altKey).point;
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
  /** Shared by every path that adds one measurement to the local items mirror (new draw, count marker, undo-restoring an erased one) -- keeps totalMetres/count/lineTotalGbp recompute in exactly one place. */
  function addMeasurementToItemState(itemId: string, measurement: TakeoffMeasurementItem) {
    setItems((cur) =>
      cur.map((it) => {
        if (it.id !== itemId) return it;
        const measurements = [...it.measurements, measurement];
        if (it.kind === "COUNT") {
          const count = it.count + 1;
          return { ...it, measurements, count, lineTotalGbp: +(count * Number(it.pricePerMetre)).toFixed(2) };
        }
        const totalMetres = +(it.totalMetres + Number(measurement.computedMetres)).toFixed(2);
        return { ...it, measurements, totalMetres, lineTotalGbp: +(totalMetres * Number(it.pricePerMetre)).toFixed(2) };
      })
    );
  }

  /** Pure create: calls the server action, mirrors the result into items, and returns the new measurement -- no history side effects, so undo/redo closures can call it directly without pushing a second history entry. */
  async function createMeasurementCore(
    itemId: string,
    pageNumber: number,
    takeoffFileId: string | null,
    type: "LENGTH" | "CHAIN" | "COUNT",
    points: Point[],
    label: string | null
  ): Promise<TakeoffMeasurementItem | null> {
    const result = await createMeasurementAction(
      takeoff.id,
      { takeoffItemId: itemId, pageNumber, takeoffFileId: takeoffFileId ?? undefined, type, points, label: label ?? undefined },
      pointsPerMetre
    );
    if (!result.ok) {
      setMessage(result.message);
      return null;
    }
    const measurement: TakeoffMeasurementItem = { id: result.data.id, pageNumber, takeoffFileId, type, points, computedMetres: result.data.computedMetres, label };
    addMeasurementToItemState(itemId, measurement);
    return measurement;
  }

  /** Pure delete: calls the server action, mirrors the result into items, and returns the removed measurement's full data (needed to recreate it on undo) -- no history side effects. Reads itemsRef, not items, so it gives the right answer even when called from a redo closure long after the render that created it. */
  async function deleteMeasurementCore(itemId: string, measurementId: string): Promise<TakeoffMeasurementItem | null> {
    const item = itemsRef.current.find((i) => i.id === itemId);
    const removed = item?.measurements.find((m) => m.id === measurementId);
    if (!removed) return null;
    const result = await deleteMeasurementAction(takeoff.id, measurementId);
    if (!result.ok) return null;
    setItems((cur) =>
      cur.map((it) => {
        if (it.id !== itemId) return it;
        const measurements = it.measurements.filter((m) => m.id !== measurementId);
        if (it.kind === "COUNT") {
          const count = it.count - 1;
          return { ...it, measurements, count, lineTotalGbp: +(count * Number(it.pricePerMetre)).toFixed(2) };
        }
        const totalMetres = +(it.totalMetres - Number(removed.computedMetres)).toFixed(2);
        return { ...it, measurements, totalMetres, lineTotalGbp: +(totalMetres * Number(it.pricePerMetre)).toFixed(2) };
      })
    );
    return removed;
  }

  async function finalizeMeasurement(points: Point[], type: "LENGTH" | "CHAIN") {
    if (!selectedItemId) {
      setMessage("Select an item first.");
      setDrawPoints([]);
      return;
    }
    const itemId = selectedItemId;
    const pageNumber = currentPage;
    const takeoffFileId = activeFileId || null;
    const created = await createMeasurementCore(itemId, pageNumber, takeoffFileId, type, points, null);
    setDrawPoints([]);
    setHoverPoint(null);
    if (!created) return;
    const item = itemsRef.current.find((i) => i.id === itemId);
    if (!item) return;
    // A mutable holder, not a captured id -- redo recreates with a NEW
    // server-assigned id each time, so a later undo must delete whichever
    // id is currently live, not the one from the first creation.
    const holder = { measurementId: created.id };
    pushHistory({
      label: `Added ${type === "CHAIN" ? "chain" : "length"} on ${item.name}`,
      undo: async () => {
        await deleteMeasurementCore(itemId, holder.measurementId);
      },
      redo: async () => {
        const recreated = await createMeasurementCore(itemId, pageNumber, takeoffFileId, type, points, null);
        if (recreated) holder.measurementId = recreated.id;
      },
    });
  }

  /** A COUNT marker is one point, one measurement, quantity 1 -- see the TakeoffItemDetail.count comment in takeoff.service.ts. */
  async function createCountMarker(p: Point) {
    if (!selectedItemId) {
      setMessage("Select a count item first.");
      return;
    }
    const itemId = selectedItemId;
    const pageNumber = currentPage;
    const takeoffFileId = activeFileId || null;
    const created = await createMeasurementCore(itemId, pageNumber, takeoffFileId, "COUNT", [p], null);
    if (!created) return;
    const item = itemsRef.current.find((i) => i.id === itemId);
    if (!item) return;
    const holder = { measurementId: created.id };
    pushHistory({
      label: `Added count marker on ${item.name}`,
      undo: async () => {
        await deleteMeasurementCore(itemId, holder.measurementId);
      },
      redo: async () => {
        const recreated = await createMeasurementCore(itemId, pageNumber, takeoffFileId, "COUNT", [p], null);
        if (recreated) holder.measurementId = recreated.id;
      },
    });
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.detail > 1) return; // double-click is handled separately, below
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false; // the long-press above already finished the chain -- don't also add a point from the tap that follows it
      return;
    }
    if (panMovedRef.current) {
      panMovedRef.current = false; // a real pan drag just ended under this click -- don't also treat it as a measurement click
      return;
    }
    if (activeTool === "calibrate") {
      handleCalibrationClick(e);
      return;
    }
    if (activeTool === "select") return; // Select/Pan: a plain click does nothing, panning is a drag (below)
    if (activeTool === "count") {
      createCountMarker(trySnap(screenToPoint(e.clientX, e.clientY), e.altKey).point);
      return;
    }
    if (activeTool === "note") {
      createNoteAt(screenToPoint(e.clientX, e.clientY)); // notes aren't a measuring tool -- not in the brief's snap list
      return;
    }
    if (activeTool === "erase") return; // erasing happens by clicking the measurement/marker/note itself -- see each element's own onClick
    if (!selectedItemId) {
      setMessage("Select or add an item before measuring.");
      return;
    }
    const raw = screenToPoint(e.clientX, e.clientY);
    // Chain is Ctrl+click on the Length tool, not its own palette tool --
    // see the comment on ActiveTool for why.
    const wantsChain = e.ctrlKey || e.metaKey;

    if (drawPoints.length === 0) {
      setDrawPoints([trySnap(raw, e.altKey).point]);
      setDrawIsChain(wantsChain);
      return;
    }
    // Shift-lock takes priority over free snapping (per the brief); only
    // snap when it isn't active for this click.
    const p = e.shiftKey ? applyShiftLock(raw, drawPoints[drawPoints.length - 1]) : trySnap(raw, e.altKey).point;
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

  const MEASURING_TOOLS: ActiveTool[] = ["length", "count", "calibrate"];

  function handleOverlayMouseMove(e: React.MouseEvent) {
    if (magnifierEnabled && MEASURING_TOOLS.includes(activeTool)) {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (rect) setMagnifierPos({ clientX: e.clientX, clientY: e.clientY, canvasX: e.clientX - rect.left, canvasY: e.clientY - rect.top });
    } else if (magnifierPos) {
      setMagnifierPos(null);
    }
    // Count has no in-progress drawPoints of its own, but still benefits
    // from the live snap indicator while choosing where to drop a marker.
    if (drawPoints.length === 0 && !calibrating && activeTool !== "count") return;
    const raw = screenToPoint(e.clientX, e.clientY);
    if (!calibrating && e.shiftKey && drawPoints.length > 0) {
      setHoverSnapType(null);
      setHoverPoint(applyShiftLock(raw, drawPoints[drawPoints.length - 1]));
      return;
    }
    const snapped = trySnap(raw, e.altKey);
    setHoverSnapType(snapped.type);
    setHoverPoint(snapped.point);
  }

  function handleOverlayMouseLeave() {
    setMagnifierPos(null);
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

  // Long-press to finish a chain on touch (Drawings Part 2, section 7) --
  // double-tap is unreliable on touch (often eaten by the browser's own
  // zoom-gesture detection), so a long hold is the touch equivalent of the
  // desktop double-click in handleOverlayDoubleClick. Cancelled by any
  // real movement, so it doesn't fire under a two-finger pan/pinch.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const LONG_PRESS_MS = 500;

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

  function handleOverlayPointerDown(e: React.PointerEvent) {
    if (wantsPan(e)) {
      const container = viewerContainerRef.current;
      if (!container) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      panRef.current = { startX: e.clientX, startY: e.clientY, startScrollLeft: container.scrollLeft, startScrollTop: container.scrollTop };
      panMovedRef.current = false;
      return;
    }
    if (e.pointerType === "touch" && drawIsChain && drawPoints.length >= 2) {
      longPressFiredRef.current = false;
      longPressStartRef.current = { x: e.clientX, y: e.clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        finalizeMeasurement(drawPoints, "CHAIN");
      }, LONG_PRESS_MS);
    }
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
    if (longPressStartRef.current) {
      const dx = e.clientX - longPressStartRef.current.x;
      const dy = e.clientY - longPressStartRef.current.y;
      if (Math.hypot(dx, dy) > 10) cancelLongPress();
    }
    handleOverlayMouseMove(e);
  }

  function handleOverlayPointerUp() {
    panRef.current = null;
    cancelLongPress();
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
    if (result.ok) setItems((cur) => cur.map((it) => ({ ...it, measurements: [], totalMetres: 0, count: 0, lineTotalGbp: 0 })));
  }

  // --- Items -----------------------------------------------------------
  async function handleCreateItem(name: string, colour: string, kind: "LENGTH" | "COUNT", pricePerMetre: number) {
    const result = await createTakeoffItemAction(takeoff.id, { name, colour, kind, pricePerMetre, sortOrder: items.length });
    if (result.ok) {
      const newItem: TakeoffItemDetail = {
        id: result.data.id, name, colour, kind, pricePerMetre, sortOrder: items.length,
        overrideJointWidthMm: null, overrideJointDepthMm: null, overrideWastePercent: null,
        measurements: [], totalMetres: 0, count: 0, lineTotalGbp: 0,
      };
      setItems((cur) => [...cur, newItem]);
      setSelectedItemId(newItem.id);
    } else {
      setMessage(result.message);
    }
  }

  async function handleUpdateItemRate(id: string, pricePerMetre: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const result = await updateTakeoffItemAction(takeoff.id, id, {
      name: item.name, colour: item.colour, kind: item.kind, pricePerMetre, sortOrder: item.sortOrder,
      overrideJointWidthMm: item.overrideJointWidthMm, overrideJointDepthMm: item.overrideJointDepthMm, overrideWastePercent: item.overrideWastePercent,
    });
    if (result.ok) {
      setItems((cur) =>
        cur.map((it) =>
          it.id === id ? { ...it, pricePerMetre, lineTotalGbp: +((it.kind === "COUNT" ? it.count : it.totalMetres) * pricePerMetre).toFixed(2) } : it
        )
      );
    }
  }

  /** Worst-case materials per-item override (Drawings Part 2, section 6) -- LENGTH items only; null means "use the organisation default". */
  async function handleUpdateItemOverrides(id: string, overrides: { overrideJointWidthMm: number | null; overrideJointDepthMm: number | null; overrideWastePercent: number | null }) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const result = await updateTakeoffItemAction(takeoff.id, id, {
      name: item.name, colour: item.colour, kind: item.kind, pricePerMetre: Number(item.pricePerMetre), sortOrder: item.sortOrder,
      ...overrides,
    });
    if (result.ok) setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...overrides } : it)));
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
        id: p.id, name: p.name, colour: p.colour, kind: "LENGTH", pricePerMetre: Number(p.pricePerMetre), sortOrder: p.sortOrder,
        overrideJointWidthMm: null, overrideJointDepthMm: null, overrideWastePercent: null,
        measurements: [], totalMetres: 0, count: 0, lineTotalGbp: 0,
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

  /** User-initiated erase (Erase tool click, or deleteSelectedMeasurement) -- pushes a history entry, unlike deleteMeasurementCore which it wraps. */
  async function removeMeasurement(itemId: string, measurementId: string) {
    const item = itemsRef.current.find((i) => i.id === itemId);
    const removed = await deleteMeasurementCore(itemId, measurementId);
    if (!removed || !item) return;
    // Erasing always creates a brand-new id on undo (re-create), same
    // id-churn issue as the add/undo pair above, in the opposite direction.
    const holder = { measurementId };
    pushHistory({
      label: `Deleted ${item.name} measurement`,
      undo: async () => {
        const recreated = await createMeasurementCore(itemId, removed.pageNumber, removed.takeoffFileId, removed.type, removed.points, removed.label);
        if (recreated) holder.measurementId = recreated.id;
      },
      redo: async () => {
        await deleteMeasurementCore(itemId, holder.measurementId);
      },
    });
  }

  async function deleteSelectedMeasurement() {
    if (!selectedMeasurement) return;
    await removeMeasurement(selectedMeasurement.itemId, selectedMeasurement.measurementId);
    setSelectedMeasurement(null);
  }

  /** Click routing shared by every measurement/marker on the canvas: the Erase tool deletes on click (a basic version of Part 2 section 5's Erase tool -- the full measurements-list/undo-toast integration follows in that section), anything else selects. */
  function handleMeasurementClick(itemId: string, measurementId: string, label: string | null) {
    if (activeTool === "erase") {
      removeMeasurement(itemId, measurementId);
      return;
    }
    selectMeasurement(itemId, measurementId, label);
  }

  // --- Notes (Drawings Part 2) ---------------------------------------------
  async function createNoteAt(p: Point) {
    const result = await createTakeoffNoteAction(takeoff.id, { pageNumber: currentPage, takeoffFileId: activeFileId || undefined, x: p.x, y: p.y, text: "New note" });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const newNote = { id: result.data.id, pageNumber: currentPage, takeoffFileId: activeFileId || null, x: p.x, y: p.y, text: "New note", createdAt: result.data.createdAt };
    setNotes((cur) => [...cur, newNote]);
    setSelectedNoteId(newNote.id);
    setNoteTextDraft("New note");
  }

  function selectNote(id: string, currentText: string) {
    setSelectedMeasurement(null);
    setSelectedNoteId(id);
    setNoteTextDraft(currentText);
  }

  async function saveNoteText() {
    if (!selectedNoteId) return;
    const text = noteTextDraft.trim() || "Note";
    await updateTakeoffNoteAction(takeoff.id, selectedNoteId, { text });
    setNotes((cur) => cur.map((n) => (n.id === selectedNoteId ? { ...n, text } : n)));
    setSelectedNoteId(null);
  }

  async function deleteSelectedNote() {
    if (!selectedNoteId) return;
    await removeNote(selectedNoteId);
    setSelectedNoteId(null);
  }

  /** Soft-deleted, so the id never changes across an undo/redo cycle -- no mutable holder needed here, unlike the measurement pairs above. */
  async function removeNote(noteId: string) {
    const note = notesRef.current.find((n) => n.id === noteId);
    const result = await deleteTakeoffNoteAction(takeoff.id, noteId);
    if (result.ok) {
      setNotes((cur) => cur.filter((n) => n.id !== noteId));
      if (note) {
        pushHistory({
          label: "Deleted note",
          undo: async () => {
            const restored = await restoreTakeoffNoteAction(takeoff.id, noteId);
            if (restored.ok) setNotes((cur) => [...cur, note]);
          },
          redo: async () => {
            const result2 = await deleteTakeoffNoteAction(takeoff.id, noteId);
            if (result2.ok) setNotes((cur) => cur.filter((n) => n.id !== noteId));
          },
        });
      }
    }
  }

  /** Drag-to-move a note pin in Select mode -- stops the overlay's own pan-drag from starting, via stopPropagation on the pointerdown that triggers this. */
  function startNoteDrag(e: React.PointerEvent, note: { id: string; x: number; y: number }) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    noteDragRef.current = { id: note.id, startX: e.clientX, startY: e.clientY, originX: note.x, originY: note.y };
    noteDraggedRef.current = false;
  }

  function onNoteDrag(e: React.PointerEvent) {
    const drag = noteDragRef.current;
    if (!drag) return;
    e.stopPropagation();
    const deltaScreenX = e.clientX - drag.startX;
    const deltaScreenY = e.clientY - drag.startY;
    if (Math.abs(deltaScreenX) > 2 || Math.abs(deltaScreenY) > 2) noteDraggedRef.current = true;
    // Moves are tracked in screen-pixel delta then converted once, via the
    // same screenToPoint used for everything else, so this stays correct
    // at any zoom/pan/rotation -- rather than scaling the delta by hand.
    const originScreen = pointToScreen({ x: drag.originX, y: drag.originY });
    const newPoint = screenToPointFromOverlay(originScreen.x + deltaScreenX, originScreen.y + deltaScreenY);
    setNotes((cur) => cur.map((n) => (n.id === drag.id ? { ...n, x: newPoint.x, y: newPoint.y } : n)));
  }

  async function endNoteDrag() {
    const drag = noteDragRef.current;
    noteDragRef.current = null;
    if (!drag || !noteDraggedRef.current) return;
    const note = notes.find((n) => n.id === drag.id);
    if (!note) return;
    await updateTakeoffNoteAction(takeoff.id, drag.id, { x: note.x, y: note.y });
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

  /**
   * Extracts and caches one file's per-page text (and each text item's
   * bounding box, already converted into the same baseline/scale-1 device
   * space every stored measurement point is in -- see pointToScreen --
   * so a later highlight can reuse that same, already-proven conversion
   * instead of a separate one). Opens its own short-lived pdf.js document
   * rather than reusing the viewer's -- pdf.js documents are independent
   * as long as each gets its own byte fetch, so indexing a file that
   * isn't the one currently open doesn't disturb the viewer at all.
   */
  async function indexFileForSearch(fileId: string): Promise<void> {
    if (searchIndexRef.current.has(fileId)) return;
    const pdfjsLib = await import("pdfjs-dist");
    const doc = await pdfjsLib.getDocument({ url: `/api/takeoffs/${takeoff.id}/file?fileId=${fileId}`, disableRange: true, disableStream: true }).promise;
    try {
      const pages: { pageNumber: number; items: { text: string; minX: number; minY: number; maxX: number; maxY: number }[] }[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const baseViewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const items = (textContent.items as Array<{ str?: string; transform: number[]; width: number; height: number }>)
          .filter((it): it is { str: string; transform: number[]; width: number; height: number } => Boolean(it.str && it.str.trim().length > 0))
          .map((it) => {
            const [, , , , e, f] = it.transform;
            const p0 = baseViewport.convertToViewportPoint(e, f);
            const p1 = baseViewport.convertToViewportPoint(e + it.width, f + (it.height || 10));
            return {
              text: it.str,
              minX: Math.min(p0[0], p1[0]), minY: Math.min(p0[1], p1[1]),
              maxX: Math.max(p0[0], p1[0]), maxY: Math.max(p0[1], p1[1]),
            };
          });
        pages.push({ pageNumber: n, items });
      }
      searchIndexRef.current.set(fileId, pages);
    } finally {
      await doc.destroy();
    }
  }

  async function runSearch(query: string) {
    setSearchQuery(query);
    setActiveResultIndex(-1);
    setHighlightActive(false);
    if (!query.trim()) {
      setSearchResults([]);
      setNoSearchableText(false);
      return;
    }
    setSearching(true);
    try {
      await Promise.all(files.map((f) => indexFileForSearch(f.id)));
      const hasAnyText = files.some((f) => (searchIndexRef.current.get(f.id) ?? []).some((p) => p.items.length > 0));
      setNoSearchableText(!hasAnyText);

      const q = query.toLowerCase();
      const results: SearchResult[] = [];
      for (const file of files) {
        for (const page of searchIndexRef.current.get(file.id) ?? []) {
          const fullText = page.items.map((i) => i.text).join(" ");
          const idx = fullText.toLowerCase().indexOf(q);
          if (idx === -1) continue;
          const snippet = fullText.slice(Math.max(0, idx - 25), idx + q.length + 25).trim();
          results.push({ fileId: file.id, fileName: file.name, pageNumber: page.pageNumber, snippet });
        }
      }
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  function jumpToResult(result: SearchResult, index: number) {
    if (activeFileId !== result.fileId) setActiveFileId(result.fileId);
    setCurrentPage(result.pageNumber);
    setActiveResultIndex(index);
    setHighlightActive(true);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightActive(false), 2500);
  }

  function nextResult() {
    if (searchResults.length === 0) return;
    jumpToResult(searchResults[(activeResultIndex + 1) % searchResults.length], (activeResultIndex + 1) % searchResults.length);
  }

  function previousResult() {
    if (searchResults.length === 0) return;
    const next = (activeResultIndex - 1 + searchResults.length) % searchResults.length;
    jumpToResult(searchResults[next], next);
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
  // Each COUNT marker's sequence number for its own item, across the whole
  // drawing (not just this page) -- "a numbered dot", per the brief.
  const countMarkerNumbers = new Map<string, number>();
  for (const it of items) {
    let n = 0;
    for (const m of it.measurements) if (m.type === "COUNT") countMarkerNumbers.set(m.id, ++n);
  }
  // Show/hide (Drawings Part 2, section 5) -- view-only: hidden items are
  // skipped here (canvas render AND hit-testing, since a filtered-out
  // measurement simply has no DOM element to click), but items/totals
  // themselves (ItemsPanel, OutputActions, MaterialsPanel, grand totals)
  // never read hiddenItemIds at all, so visibility can never change a
  // total, quote or export.
  const pageMeasurements = items
    .filter((it) => !hiddenItemIds.has(it.id))
    .flatMap((it) =>
      it.measurements
        .filter((m) => m.pageNumber === currentPage && (m.takeoffFileId ?? firstFileId) === activeFileId)
        .map((m) => ({ ...m, colour: it.colour, itemId: it.id }))
    );
  const pageNotes = notes.filter((n) => n.pageNumber === currentPage && (n.takeoffFileId ?? firstFileId) === activeFileId);
  const drawingMetres = drawPoints.length > 0 ? chainLengthPoints(hoverPoint ? [...drawPoints, hoverPoint] : drawPoints) / pointsPerMetre : null;

  // --- Measurements list (Drawings Part 2, section 5) ---------------------
  function fileNameFor(fileId: string | null): string {
    const resolvedId = fileId ?? firstFileId;
    return files.find((f) => f.id === resolvedId)?.name ?? "Plan";
  }
  const measurementRows: MeasurementRow[] = [
    ...items.flatMap((it) =>
      it.measurements.map((m): MeasurementRow => ({
        key: m.id,
        group: "item",
        itemId: it.id,
        itemName: it.name,
        itemColour: it.colour,
        measurementId: m.id,
        fileId: m.takeoffFileId,
        fileName: fileNameFor(m.takeoffFileId),
        pageNumber: m.pageNumber,
        label: m.label,
        point: m.points[0],
        sizeText: m.type === "COUNT" ? "1 (count)" : `${Number(m.computedMetres)} m`,
        sortSize: m.type === "COUNT" ? 1 : Number(m.computedMetres),
      }))
    ),
    ...notes.map((n): MeasurementRow => ({
      key: n.id,
      group: "note",
      noteId: n.id,
      fileId: n.takeoffFileId,
      fileName: fileNameFor(n.takeoffFileId),
      pageNumber: n.pageNumber,
      label: n.text,
      point: { x: n.x, y: n.y },
      sizeText: "Note",
      sortSize: 0,
    })),
  ];

  /** Jumps to a row's file/page, selects it, and centres it once that page has actually rendered (pendingCenterRef, resolved by the effect watching viewportSize below) -- the same "wait for the real render" pattern zoom-at-cursor already uses. */
  function jumpToRow(row: MeasurementRow) {
    const targetFileId = row.fileId ?? firstFileId ?? activeFileId;
    if (targetFileId !== activeFileId) setActiveFileId(targetFileId);
    setCurrentPage(row.pageNumber);
    pendingCenterRef.current = row.point;
    if (row.group === "item" && row.itemId && row.measurementId) selectMeasurement(row.itemId, row.measurementId, row.label);
    else if (row.noteId) selectNote(row.noteId, row.label ?? "");
  }

  // Highlight boxes for the current search match, converted through the
  // SAME pointToScreen used for measurements -- so they land correctly at
  // any zoom, pan or view rotation with no separate math of their own.
  const highlightBoxes =
    highlightActive && searchQuery.trim()
      ? (searchIndexRef.current.get(activeFileId) ?? [])
          .find((p) => p.pageNumber === currentPage)
          ?.items.filter((it) => it.text.toLowerCase().includes(searchQuery.trim().toLowerCase()))
          .map((it) => {
            const topLeft = pointToScreen({ x: it.minX, y: it.minY });
            const bottomRight = pointToScreen({ x: it.maxX, y: it.maxY });
            return { x: Math.min(topLeft.x, bottomRight.x), y: Math.min(topLeft.y, bottomRight.y), width: Math.abs(bottomRight.x - topLeft.x), height: Math.abs(bottomRight.y - topLeft.y) };
          }) ?? []
      : [];

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
        onUpdateItemOverrides={handleUpdateItemOverrides}
        materialDefaults={materialDefaults}
        hiddenItemIds={hiddenItemIds}
        onToggleVisibility={toggleItemVisibility}
        onShowAll={showAllItems}
        onHideAll={hideAllItems}
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
    search: (
      <SearchPanel
        query={searchQuery}
        onQueryChange={runSearch}
        searching={searching}
        results={searchResults}
        activeResultIndex={activeResultIndex}
        noSearchableText={noSearchableText}
        onJumpToResult={jumpToResult}
        onNext={nextResult}
        onPrevious={previousResult}
      />
    ),
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
    ) : selectedNoteId ? (
      <div className="space-y-2 text-sm">
        <span className="text-xs text-muted-foreground">Note</span>
        <Input value={noteTextDraft} onChange={(e) => setNoteTextDraft(e.target.value)} className="h-8 w-full" placeholder="e.g. check access" autoFocus />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={saveNoteText}>Save</Button>
          <Button type="button" size="sm" variant="destructive" onClick={deleteSelectedNote}>Delete</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedNoteId(null)}>Close</Button>
        </div>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">Click a measurement, count marker or note on the plan to select it.</p>
    ),
    materials: <MaterialsPanel items={items} defaults={materialDefaults} />,
    measurements: <MeasurementsListPanel rows={measurementRows} currentPage={currentPage} onJump={jumpToRow} onHoverRow={setHoveredRowKey} />,
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
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-2 text-sm shadow-xl">
          <span>{toast.text}</span>
          <Button type="button" size="sm" variant="outline" onClick={toast.action === "undo" ? performUndo : performRedo}>
            {toast.action === "undo" ? "Undo" : "Redo"}
          </Button>
        </div>
      )}

      {magnifierEnabled && magnifierPos && (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden rounded-full border-2 border-brand-plum bg-white shadow-xl"
          style={{ left: magnifierPos.clientX + 24, top: magnifierPos.clientY - MAGNIFIER_SIZE - 24, width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE }}
        >
          <canvas ref={magnifierCanvasRef} width={MAGNIFIER_SIZE} height={MAGNIFIER_SIZE} />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-plum" />
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-lg border bg-card p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Keyboard shortcuts</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowShortcuts(false)}>Close</Button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {[
                ["V", "Select / pan"],
                ["L", "Length (Ctrl+click to start a chain)"],
                ["C", "Count"],
                ["N", "Note"],
                ["K", "Calibrate"],
                ["E", "Erase"],
                ["Shift (hold)", "Lock to 0/45/90 degrees"],
                ["S", "Toggle snap to lines and corners"],
                ["Alt (hold)", "Bypass snap for one click"],
                ["M", "Toggle magnifier loupe"],
                ["R", "Rotate view"],
                ["F or 1", "Fit page"],
                ["2", "Fit width"],
                ["Ctrl+Z", "Undo"],
                ["Ctrl+Shift+Z or Ctrl+Y", "Redo"],
                ["Esc", "Cancel the current draw or calibration"],
                ["Enter", "Finish a chain"],
                ["?", "Toggle this cheat sheet"],
              ].map(([key, desc]) => (
                <Fragment key={key}>
                  <dt className="whitespace-nowrap font-mono text-xs text-muted-foreground">{key}</dt>
                  <dd>{desc}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </div>
      )}
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
            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              type="button"
              size="sm"
              variant={snapEnabled ? "default" : "outline"}
              onClick={toggleSnap}
              title="Snap to drawing lines and corners (S) -- hold Alt to bypass for one click"
            >
              <Magnet className="h-3.5 w-3.5" /> Snap
            </Button>
            {snapEnabled && snapNoVectors && (
              <span className="text-xs text-muted-foreground">No vectors on this page (looks scanned) -- snapping has nothing to snap to here.</span>
            )}
            <Button
              type="button"
              size="sm"
              variant={magnifierEnabled ? "default" : "outline"}
              onClick={() => setMagnifierEnabled((v) => !v)}
              title="Magnifier loupe while measuring (M)"
            >
              <Search className="h-3.5 w-3.5" /> Magnifier
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button type="button" size="sm" variant="outline" disabled={undoStackRef.current.length === 0} onClick={performUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={redoStackRef.current.length === 0} onClick={performRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
              <HelpCircle className="h-3.5 w-3.5" />
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
                  onPointerLeave={handleOverlayMouseLeave}
                >
                  {pageMeasurements.map((m) => {
                    const screenPts = m.points.map(pointToScreen);
                    const isSelected = selectedMeasurement?.measurementId === m.id;
                    const isHovered = hoveredRowKey === m.id;
                    const emphasised = isSelected || isHovered;

                    if (m.type === "COUNT") {
                      const p = screenPts[0];
                      const n = countMarkerNumbers.get(m.id) ?? "";
                      return (
                        <g key={m.id} onClick={(e) => { e.stopPropagation(); handleMeasurementClick(m.itemId, m.id, m.label); }} className="cursor-pointer">
                          <circle cx={p.x} cy={p.y} r={emphasised ? 11 : 9} fill={m.colour} stroke="#fff" strokeWidth={emphasised ? 3 : 2} />
                          <text x={p.x} y={p.y} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="central">{n}</text>
                          {m.label && (
                            <text x={p.x} y={p.y - 15} fontSize={11} fill={m.colour} fontWeight={600} style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>{m.label}</text>
                          )}
                        </g>
                      );
                    }

                    const midpoint = screenPts[Math.floor(screenPts.length / 2)];
                    return (
                      <g key={m.id} onClick={(e) => { e.stopPropagation(); handleMeasurementClick(m.itemId, m.id, m.label); }}>
                        <polyline
                          points={screenPts.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill="none"
                          stroke={m.colour}
                          strokeWidth={emphasised ? 4 : 2.5}
                          strokeDasharray={isSelected ? "6 3" : undefined}
                        />
                        {screenPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={m.colour} />)}
                        <text x={midpoint.x} y={midpoint.y - 6} fontSize={11} fill={m.colour} fontWeight={600} style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>
                          {Number(m.computedMetres)}m{m.label ? ` — ${m.label}` : ""}
                        </text>
                      </g>
                    );
                  })}

                  {pageNotes.map((note) => {
                    const p = pointToScreen({ x: note.x, y: note.y });
                    const isSelected = selectedNoteId === note.id;
                    const emphasised = isSelected || hoveredRowKey === note.id;
                    return (
                      <g
                        key={note.id}
                        className={activeTool === "select" ? "cursor-move" : "cursor-pointer"}
                        onPointerDown={(e) => startNoteDrag(e, note)}
                        onPointerMove={onNoteDrag}
                        onPointerUp={endNoteDrag}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (noteDraggedRef.current) {
                            noteDraggedRef.current = false;
                            return;
                          }
                          if (activeTool === "erase") {
                            removeNote(note.id);
                            return;
                          }
                          selectNote(note.id, note.text);
                        }}
                      >
                        <circle cx={p.x} cy={p.y} r={emphasised ? 10 : 8} fill="#3C2263" stroke="#fff" strokeWidth={2} />
                        <text x={p.x} y={p.y} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="central">!</text>
                        <title>{note.text}</title>
                        {isSelected && (
                          <text x={p.x} y={p.y - 16} fontSize={11} fill="#3C2263" fontWeight={600} style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>{note.text}</text>
                        )}
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

                  {hoverSnapType && hoverPoint && (() => {
                    const sp = pointToScreen(hoverPoint);
                    const colour = "#15803D";
                    // A different marker shape per snap type, per the brief.
                    if (hoverSnapType === "endpoint") {
                      return <rect x={sp.x - 5} y={sp.y - 5} width={10} height={10} fill="none" stroke={colour} strokeWidth={2} />;
                    }
                    if (hoverSnapType === "intersection") {
                      return <rect x={sp.x - 5} y={sp.y - 5} width={10} height={10} fill="none" stroke={colour} strokeWidth={2} transform={`rotate(45 ${sp.x} ${sp.y})`} />;
                    }
                    return <circle cx={sp.x} cy={sp.y} r={6} fill="none" stroke={colour} strokeWidth={2} />;
                  })()}

                  {calibrationPoints.map((p, i) => {
                    const sp = pointToScreen(p);
                    return <circle key={i} cx={sp.x} cy={sp.y} r={4} fill="#B91C1C" />;
                  })}
                  {calibrationPoints.length === 1 && hoverPoint && (
                    <line x1={pointToScreen(calibrationPoints[0]).x} y1={pointToScreen(calibrationPoints[0]).y} x2={pointToScreen(hoverPoint).x} y2={pointToScreen(hoverPoint).y} stroke="#B91C1C" strokeWidth={2} strokeDasharray="4 4" />
                  )}
                  {highlightBoxes.map((box, i) => (
                    <rect key={i} x={box.x - 2} y={box.y - 2} width={box.width + 4} height={box.height + 4} fill="#FDE68A" fillOpacity={0.6} stroke="#CA8A04" strokeWidth={1.5} />
                  ))}
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
            shiftLocked={shiftHeld && drawPoints.length > 0 && (activeTool === "length")}
            snapType={hoverSnapType}
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
