import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { listTechnicians, type TechnicianOption } from "@/services/job.service";
import { listJobsForMap, ensurePropertyGeocoded, type MapJobItem } from "@/services/map.service";
import { MapView } from "./map-view";

export const dynamic = "force-dynamic";

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function loadMapData(dateISO: string, technicianId?: string) {
  try {
    const [technicians, jobs] = await Promise.all([listTechnicians(), listJobsForMap(dateISO, technicianId)]);

    // Pins render immediately with whatever coordinates are already cached —
    // any property missing lat/lng gets geocoded here without blocking this
    // response, so a slow lookup never holds up the map. It'll simply show up
    // once cached, on the next load.
    const ungeocoded = jobs.filter((job) => job.property && (job.property.latitude == null || job.property.longitude == null));
    if (ungeocoded.length > 0) {
      void Promise.all(ungeocoded.map((job) => ensurePropertyGeocoded(job.property!.id))).catch(() => {});
    }

    return { technicians, jobs, dbOnline: true };
  } catch {
    return { technicians: [] as TechnicianOption[], jobs: [] as MapJobItem[], dbOnline: false };
  }
}

export default async function MapPage({ searchParams }: { searchParams: { date?: string; technicianId?: string } }) {
  const user = await getCurrentUser();
  const dateISO = searchParams.date ?? todayISO();
  // TECHNICIAN always sees (and can only plan) their own day — the query
  // param is ignored for them rather than trusted from the client, same
  // scoping pattern as the jobs list.
  const technicianId = user?.role === "TECHNICIAN" ? user.id : searchParams.technicianId;

  const { technicians, jobs, dbOnline } = await loadMapData(dateISO, technicianId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Map &amp; route planner</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <MapView
          dateISO={dateISO}
          technicians={technicians}
          jobs={jobs}
          selectedTechnicianId={technicianId ?? null}
          lockTechnician={user?.role === "TECHNICIAN"}
          canPlanForOthers={user?.role === "ADMIN" || user?.role === "OFFICE"}
          selfTechnicianId={user?.role === "TECHNICIAN" ? user.id : null}
          canRegeocode={user?.role === "ADMIN"}
          mapboxPublicToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
        />
      )}
    </div>
  );
}
