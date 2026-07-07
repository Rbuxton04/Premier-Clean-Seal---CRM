"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { MapPinOff, Wrench, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { jobStatusLabels } from "@/validators/job";
import type { MapJobItem } from "@/services/map.service";
import type { TechnicianOption } from "@/services/job.service";
import type { PlanRouteResult } from "@/services/route.service";
import { PlanDayPanel } from "./plan-day-panel";
import { regeocodeBadPropertiesAction } from "./actions";

// Home view for the map: Leigh, Greater Manchester, at a zoom that comfortably
// shows Leigh plus surrounding towns (Wigan, Atherton, Tyldesley, Hindley,
// Golborne) — most jobs fall in this area. Used on first load before any
// pins are plotted, and as the resting view whenever there are none.
const DEFAULT_CENTER: [number, number] = [-2.5178, 53.4975];
const DEFAULT_ZOOM = 11;

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "#0284C7",
  IN_PROGRESS: "#3C2263",
  ON_HOLD: "#D97706",
  COMPLETED: "#059669",
};
const TECH_PALETTE = ["#3C2263", "#6A46A8", "#0E7490", "#B45309", "#BE123C", "#15803D"];

function colorForTechnician(technicianId: string | null, technicians: TechnicianOption[]): string {
  if (!technicianId) return "#58606B";
  const idx = technicians.findIndex((t) => t.id === technicianId);
  return TECH_PALETTE[idx >= 0 ? idx % TECH_PALETTE.length : 0];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function MapView({
  dateISO,
  technicians,
  jobs,
  selectedTechnicianId,
  lockTechnician,
  canPlanForOthers,
  selfTechnicianId,
  canRegeocode,
  mapboxPublicToken,
}: {
  dateISO: string;
  technicians: TechnicianOption[];
  jobs: MapJobItem[];
  selectedTechnicianId: string | null;
  lockTechnician: boolean;
  canPlanForOthers: boolean;
  selfTechnicianId: string | null;
  canRegeocode: boolean;
  mapboxPublicToken: string;
}) {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const routeMarkersRef = useRef<MapboxMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [planResult, setPlanResult] = useState<PlanRouteResult | null>(null);
  const [regeocoding, setRegeocoding] = useState(false);
  const [regeocodeSummary, setRegeocodeSummary] = useState<string | null>(null);

  async function handleRegeocode() {
    setRegeocoding(true);
    setRegeocodeSummary(null);
    const result = await regeocodeBadPropertiesAction();
    setRegeocodeSummary(
      `Checked ${result.checked} propert${result.checked === 1 ? "y" : "ies"} needing a fix — corrected ${result.fixed}` +
        (result.unresolved > 0 ? `, ${result.unresolved} still unresolved.` : ".")
    );
    setRegeocoding(false);
    router.refresh();
  }

  function updateQuery(next: { date?: string; technicianId?: string | null }) {
    const params = new URLSearchParams();
    params.set("date", next.date ?? dateISO);
    const tech = next.technicianId !== undefined ? next.technicianId : selectedTechnicianId;
    if (tech) params.set("technicianId", tech);
    router.push(`/map?${params.toString()}`);
  }

  // Initialise the map once a public token is available.
  useEffect(() => {
    if (!mapboxPublicToken || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !mapContainerRef.current) return;
      mapboxgl.accessToken = mapboxPublicToken;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.on("load", () => setMapReady(true));
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxPublicToken]);

  // Plot today's job pins whenever the job list, filter, or map readiness changes.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !mapRef.current) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = new mapboxgl.LngLatBounds();
      const points: [number, number][] = [];

      for (const job of jobs) {
        const lat = job.property?.latitude;
        const lng = job.property?.longitude;
        if (lat == null || lng == null) continue;
        const color = selectedTechnicianId
          ? STATUS_COLORS[job.status] ?? "#58606B"
          : colorForTechnician(job.technician?.id ?? null, technicians);

        const popupHtml = `
          <div style="font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.5;">
            <strong>${escapeHtml(job.jobNumber)}</strong><br/>
            ${escapeHtml(job.customer.name)}<br/>
            ${job.property ? escapeHtml(`${job.property.addressLine1}, ${job.property.postcode}`) : ""}<br/>
            ${job.scheduledStart ? escapeHtml(new Date(job.scheduledStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })) : ""}<br/>
            <a href="/jobs/${job.id}" style="color:#3C2263;font-weight:600;">View job -&gt;</a>
          </div>`;
        const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(popupHtml);
        const marker = new mapboxgl.Marker({ color }).setLngLat([lng, lat]).setPopup(popup).addTo(mapRef.current);
        markersRef.current.push(marker);
        bounds.extend([lng, lat]);
        points.push([lng, lat]);
      }

      if (points.length === 1) {
        // A single pin — centre on it, but not at a street-level zoom.
        mapRef.current.easeTo({ center: points[0], zoom: 14, duration: 0 });
      } else if (points.length > 1) {
        try {
          // maxZoom keeps a tight cluster of jobs (e.g. all within Leigh)
          // resting close to the default home view rather than zooming in
          // past street level.
          mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 0 });
        } catch {
          // Empty/degenerate bounds — ignore.
        }
      } else {
        // No jobs with coordinates today — rest on the Leigh home view.
        mapRef.current.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobs, mapReady, selectedTechnicianId, technicians]);

  // Draw the optimised route line + numbered stop markers when a plan exists.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;

      routeMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current = [];
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getSource("route-line")) map.removeSource("route-line");

      if (!planResult || !planResult.ok) return;

      const originEl = document.createElement("div");
      originEl.style.cssText =
        "background:#2E333B;color:#fff;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);";
      originEl.textContent = "S";
      routeMarkersRef.current.push(
        new mapboxgl.Marker({ element: originEl }).setLngLat([planResult.origin.longitude, planResult.origin.latitude]).addTo(map)
      );

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([planResult.origin.longitude, planResult.origin.latitude]);

      for (const stop of planResult.stops) {
        const el = document.createElement("div");
        el.style.cssText =
          "background:#3C2263;color:#fff;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);";
        el.textContent = String(stop.order);
        routeMarkersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([stop.longitude, stop.latitude]).addTo(map));
        bounds.extend([stop.longitude, stop.latitude]);
      }

      if (planResult.geometry) {
        map.addSource("route-line", { type: "geojson", data: { type: "Feature", geometry: planResult.geometry, properties: {} } });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#6A46A8", "line-width": 4, "line-opacity": 0.85 },
        });
      }

      try {
        map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 400 });
      } catch {
        // Empty/degenerate bounds — ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planResult, mapReady]);

  const planningTechnician = selectedTechnicianId ? technicians.find((t) => t.id === selectedTechnicianId) ?? null : null;
  const canPlan = !!planningTechnician && (selfTechnicianId === planningTechnician.id || canPlanForOthers);

  if (!mapboxPublicToken) {
    return (
      <div className="space-y-4">
        <Badge variant="warning">
          Map &amp; routing need a Mapbox token — add NEXT_PUBLIC_MAPBOX_TOKEN / MAPBOX_SECRET_TOKEN.
        </Badge>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs scheduled for this day.</p>
        ) : (
          <ul className="space-y-1.5">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-md border px-3 py-2 text-sm">
                <Link href={`/jobs/${job.id}`} className="font-medium text-primary hover:underline">{job.jobNumber}</Link>
                {" — "}
                {job.customer.name}
                {job.property && ` — ${job.property.addressLine1}, ${job.property.postcode}`}
                {job.scheduledStart && ` — ${new Date(job.scheduledStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={dateISO}
          onChange={(e) => updateQuery({ date: e.target.value })}
          className="h-9 w-auto"
        />
        {!lockTechnician && (
          <Select
            value={selectedTechnicianId ?? ""}
            onChange={(e) => updateQuery({ technicianId: e.target.value || null })}
            className="h-9 w-auto"
          >
            <option value="">All technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        )}
        {selectedTechnicianId && (
          <span className="text-xs text-muted-foreground">
            Pins coloured by status. {jobs.length} job{jobs.length === 1 ? "" : "s"} today.
          </span>
        )}
        {!selectedTechnicianId && (
          <span className="text-xs text-muted-foreground">
            Pins coloured by technician. {jobs.length} job{jobs.length === 1 ? "" : "s"} today.
          </span>
        )}
        {canRegeocode && (
          <Button size="sm" variant="outline" onClick={handleRegeocode} disabled={regeocoding} className="ml-auto">
            {regeocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            Fix pin locations
          </Button>
        )}
      </div>

      {regeocodeSummary && <Badge variant="warning">{regeocodeSummary}</Badge>}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative h-[50vh] min-h-[320px] flex-1 overflow-hidden rounded-lg border lg:h-[600px]">
          <div ref={mapContainerRef} className="h-full w-full" />
          {jobs.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70">
              <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow">
                <MapPinOff className="h-4 w-4" /> No jobs scheduled for this day.
              </div>
            </div>
          )}
        </div>

        <div className="w-full space-y-3 lg:w-96 lg:shrink-0">
          {planningTechnician && canPlan ? (
            <PlanDayPanel
              key={`${planningTechnician.id}:${dateISO}`}
              dateISO={dateISO}
              technicianId={planningTechnician.id}
              technicianName={planningTechnician.name}
              onResult={setPlanResult}
            />
          ) : planningTechnician ? (
            <Badge variant="warning">Only {planningTechnician.name} or the office can plan this day.</Badge>
          ) : (
            <p className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
              Pick a technician above to plan their day.
            </p>
          )}

          <div className="hidden lg:block">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status key</p>
            <div className="space-y-1 text-xs">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {jobStatusLabels[status as keyof typeof jobStatusLabels] ?? status}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
