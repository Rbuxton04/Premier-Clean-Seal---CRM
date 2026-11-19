"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Persists the SketchUp-style workspace's panel layout (open/collapsed,
// order, floating positions, tray width) per browser in localStorage, per
// the brief. Every read and write is wrapped in try/catch with a safe
// fallback to defaults -- localStorage can throw (private browsing, quota,
// disabled storage) or simply not exist (SSR's first render), and this must
// never crash the workspace over a convenience feature.

export type PanelId = "items" | "scale" | "pages" | "search" | "selected" | "output";

export type PanelState = {
  collapsed: boolean;
  floating: boolean;
  floatX: number;
  floatY: number;
};

export type WorkspaceLayout = {
  panelOrder: PanelId[];
  panels: Record<PanelId, PanelState>;
  trayCollapsed: boolean;
  trayWidth: number;
};

const STORAGE_KEY = "drawings-workspace-layout-v1";

const DEFAULT_PANEL_ORDER: PanelId[] = ["items", "scale", "pages", "search", "selected", "output"];

function defaultPanelState(): PanelState {
  return { collapsed: false, floating: false, floatX: 80, floatY: 80 };
}

function defaultLayout(): WorkspaceLayout {
  return {
    panelOrder: [...DEFAULT_PANEL_ORDER],
    panels: Object.fromEntries(DEFAULT_PANEL_ORDER.map((id) => [id, defaultPanelState()])) as Record<PanelId, PanelState>,
    trayCollapsed: false,
    trayWidth: 320,
  };
}

/** Loose shape check, not full validation -- a stored value that merely has the right top-level keys is trusted; anything else (corrupt JSON, an old incompatible shape, a future shape this version doesn't know) falls back to defaults rather than crash the workspace. */
function isPlausibleLayout(value: unknown): value is WorkspaceLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<WorkspaceLayout>;
  return Array.isArray(v.panelOrder) && typeof v.panels === "object" && v.panels !== null && typeof v.trayCollapsed === "boolean" && typeof v.trayWidth === "number";
}

function loadLayout(): WorkspaceLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw);
    if (!isPlausibleLayout(parsed)) return defaultLayout();
    // Merge onto defaults so a panel introduced in a later release (not in
    // an older stored layout) still gets a sane starting state instead of
    // being undefined.
    const base = defaultLayout();
    return {
      panelOrder: parsed.panelOrder.filter((id): id is PanelId => DEFAULT_PANEL_ORDER.includes(id as PanelId)).length
        ? parsed.panelOrder.filter((id): id is PanelId => DEFAULT_PANEL_ORDER.includes(id as PanelId))
        : base.panelOrder,
      panels: { ...base.panels, ...parsed.panels },
      trayCollapsed: parsed.trayCollapsed,
      trayWidth: parsed.trayWidth,
    };
  } catch {
    return defaultLayout();
  }
}

function saveLayout(layout: WorkspaceLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable/full/blocked -- the workspace still works for
    // this session, it just won't remember the layout next time.
  }
}

export function useWorkspaceLayout() {
  // Starts from the default on the server/first client render (SSR has no
  // localStorage), then swaps in the saved layout once mounted -- avoids a
  // hydration mismatch from reading storage during render.
  const [layout, setLayout] = useState<WorkspaceLayout>(defaultLayout);
  const hydrated = useRef(false);

  useEffect(() => {
    setLayout(loadLayout());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return; // don't immediately re-save the default over a real stored layout before it's loaded
    saveLayout(layout);
  }, [layout]);

  const toggleCollapsed = useCallback((id: PanelId) => {
    setLayout((cur) => ({ ...cur, panels: { ...cur.panels, [id]: { ...cur.panels[id], collapsed: !cur.panels[id].collapsed } } }));
  }, []);

  const setFloating = useCallback((id: PanelId, floating: boolean) => {
    setLayout((cur) => ({ ...cur, panels: { ...cur.panels, [id]: { ...cur.panels[id], floating } } }));
  }, []);

  const moveFloating = useCallback((id: PanelId, x: number, y: number) => {
    setLayout((cur) => ({ ...cur, panels: { ...cur.panels, [id]: { ...cur.panels[id], floatX: x, floatY: y } } }));
  }, []);

  const reorder = useCallback((panelOrder: PanelId[]) => {
    setLayout((cur) => ({ ...cur, panelOrder }));
  }, []);

  const setTrayCollapsed = useCallback((trayCollapsed: boolean) => {
    setLayout((cur) => ({ ...cur, trayCollapsed }));
  }, []);

  const setTrayWidth = useCallback((trayWidth: number) => {
    setLayout((cur) => ({ ...cur, trayWidth: Math.min(480, Math.max(240, trayWidth)) }));
  }, []);

  const reset = useCallback(() => {
    setLayout(defaultLayout());
  }, []);

  return { layout, toggleCollapsed, setFloating, moveFloating, reorder, setTrayCollapsed, setTrayWidth, reset };
}
