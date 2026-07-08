"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation, MapPin, Loader2, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { planMyDayAction, geocodeOriginAction } from "./actions";
import type { PlanRouteResult, FinishMode } from "@/services/route.service";
import { buildGoogleMapsMultiStopUrl, buildGoogleMapsSingleStopUrl, buildAppleMapsSingleStopUrl, isIOS } from "@/lib/nav-links";

type Phase = "idle" | "locating" | "origin-fallback" | "loading" | "done";

function formatKm(meters: number | null): string {
  if (meters == null) return "—";
  return `${(meters / 1000).toFixed(1)} km`;
}
function formatMinutes(seconds: number | null): string {
  if (seconds == null) return "—";
  return `${Math.round(seconds / 60)} min`;
}

export function PlanDayPanel({
  dateISO,
  technicianId,
  technicianName,
  hasHomeAddress,
  onResult,
}: {
  dateISO: string;
  technicianId: string;
  technicianName: string;
  hasHomeAddress: boolean;
  onResult: (result: PlanRouteResult | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PlanRouteResult | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [iOS, setIOS] = useState(false);
  const [finishMode, setFinishMode] = useState<FinishMode>(hasHomeAddress ? "home" : "none");
  const [customFinishAddress, setCustomFinishAddress] = useState("");

  useEffect(() => setIOS(isIOS()), []);

  async function submit(origin: { latitude: number; longitude: number } | null, originSource?: "geolocation" | "manual") {
    setPhase("loading");
    const res = await planMyDayAction({
      technicianId,
      dateISO,
      origin,
      originSource,
      finishMode,
      customFinishAddress: finishMode === "custom" ? customFinishAddress.trim() : null,
    });
    setResult(res);
    onResult(res);
    setPhase("done");
  }

  function startPlanning() {
    setManualError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPhase("origin-fallback");
      return;
    }
    setPhase("locating");
    try {
      // A Permissions-Policy block (as opposed to a user denying the
      // browser's own prompt) can throw synchronously here rather than
      // reaching the error callback below, depending on the browser — this
      // is on-demand (only called from this button, never on page load), so
      // either path just falls back to manual/first-job start, same as a
      // normal permission denial.
      navigator.geolocation.getCurrentPosition(
        (pos) => submit({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, "geolocation"),
        () => setPhase("origin-fallback"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } catch {
      setPhase("origin-fallback");
    }
  }

  async function useManualAddress() {
    setManualError(null);
    if (manualAddress.trim().length < 3) {
      setManualError("Enter a postcode or address.");
      return;
    }
    setPhase("loading");
    const geocoded = await geocodeOriginAction({ address: manualAddress.trim() });
    if (!geocoded) {
      setManualError("Couldn't find that address.");
      setPhase("origin-fallback");
      return;
    }
    await submit(geocoded, "manual");
  }

  function reset() {
    setResult(null);
    onResult(null);
    setManualAddress("");
    setManualError(null);
    setPhase("idle");
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Plan my day</h2>
        {result && (
          <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        )}
      </div>

      {!result && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Finish at</label>
          <Select value={finishMode} onChange={(e) => setFinishMode(e.target.value as FinishMode)} className="h-8 text-sm">
            <option value="home" disabled={!hasHomeAddress}>
              {hasHomeAddress ? "Home (default)" : "Home (set an address above first)"}
            </option>
            <option value="none">No finish — end at last job</option>
            <option value="custom">Custom address…</option>
          </Select>
          {finishMode === "custom" && (
            <Input
              value={customFinishAddress}
              onChange={(e) => setCustomFinishAddress(e.target.value)}
              placeholder="e.g. WN7 1AB"
              className="h-8 text-sm"
            />
          )}
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Builds the fastest visiting order for {technicianName}&apos;s jobs on this day, starting from their current location.
          </p>
          <Button size="sm" onClick={startPlanning}>
            <Navigation className="h-3.5 w-3.5" /> Plan {technicianName}&apos;s day
          </Button>
        </div>
      )}

      {phase === "locating" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Getting your location…
        </p>
      )}

      {phase === "origin-fallback" && (
        <div className="space-y-3">
          <Badge variant="warning">Couldn&apos;t get your location.</Badge>
          <Button size="sm" variant="outline" onClick={() => submit(null)}>
            <MapPin className="h-3.5 w-3.5" /> Use first job as start point
          </Button>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Or enter a start address / postcode:</p>
            <div className="flex gap-2">
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="e.g. WN1 1XL"
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={useManualAddress}>Use this</Button>
            </div>
            {manualError && <p className="text-xs text-destructive">{manualError}</p>}
          </div>
        </div>
      )}

      {phase === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Working out the best route…
        </p>
      )}

      {phase === "done" && result && !result.ok && (
        <div className="space-y-2">
          <Badge variant="warning">{result.message}</Badge>
          <Button size="sm" variant="outline" onClick={reset}>Try again</Button>
        </div>
      )}

      {phase === "done" && result && result.ok && (
        <div className="space-y-3">
          {result.message && <Badge variant="warning">{result.message}</Badge>}
          {result.unroutedJobIds.length > 0 && (
            <Badge variant="warning">
              {result.unroutedJobIds.length} job{result.unroutedJobIds.length === 1 ? "" : "s"} couldn&apos;t be located and {result.unroutedJobIds.length === 1 ? "isn't" : "aren't"} included.
            </Badge>
          )}

          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total distance</p>
              <p className="font-medium">{formatKm(result.totalDistanceMeters)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total drive time</p>
              <p className="font-medium">{formatMinutes(result.totalDurationSeconds)}</p>
            </div>
          </div>

          <ol className="space-y-1.5">
            {result.stops.map((stop) => (
              <li key={stop.jobId} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-plum text-[11px] font-semibold text-white">
                  {stop.order}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/jobs/${stop.jobId}`} className="font-medium text-primary hover:underline">
                    {stop.jobNumber}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{stop.customerName} — {stop.address}</p>
                  {stop.legDurationSeconds != null && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatMinutes(stop.legDurationSeconds)} · {formatKm(stop.legDistanceMeters)} from previous stop
                    </p>
                  )}
                </div>
              </li>
            ))}
            {result.finish && (
              <li className="flex items-start gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F766E] text-white">
                  <Home className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{result.finish.label}</p>
                  {result.finish.address && <p className="truncate text-xs text-muted-foreground">{result.finish.address}</p>}
                  {result.finish.legDurationSeconds != null && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatMinutes(result.finish.legDurationSeconds)} · {formatKm(result.finish.legDistanceMeters)} from previous stop
                    </p>
                  )}
                </div>
              </li>
            )}
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <a
                href={buildGoogleMapsMultiStopUrl(
                  result.origin,
                  result.finish
                    ? [
                        ...result.stops,
                        {
                          latitude: result.finish.latitude,
                          longitude: result.finish.longitude,
                          address: result.finish.address ?? undefined,
                        },
                      ]
                    : result.stops
                )}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="h-3.5 w-3.5" /> Start navigation
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={buildGoogleMapsSingleStopUrl(result.stops[0])} target="_blank" rel="noreferrer">
                Navigate to next stop
              </a>
            </Button>
            {iOS && (
              <Button asChild size="sm" variant="outline">
                <a href={buildAppleMapsSingleStopUrl(result.stops[0])} target="_blank" rel="noreferrer">
                  Apple Maps — next stop
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
