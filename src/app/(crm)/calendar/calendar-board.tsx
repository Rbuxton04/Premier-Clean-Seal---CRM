"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { CloudRain } from "lucide-react";
import { jobStatusBlockClass } from "@/validators/job";
import type { CalendarJobItem, TechnicianOption } from "@/services/job.service";
import { isRainLikely, type CalendarWeather, type DailyForecast } from "@/services/weather.service";
import { weatherIcon } from "@/lib/weather-icons";
import { scheduleJobAction } from "../jobs/actions";

function dateKey(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}
function sameDay(a: Date | string, b: Date) {
  return dateKey(a) === dateKey(b);
}

function JobBlock({ job, forecast, compact }: { job: CalendarJobItem; forecast?: DailyForecast; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50, position: "relative" as const } : undefined;
  const rainy = isRainLikely(forecast);

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? "opacity-40" : ""}>
      <Link
        href={`/jobs/${job.id}`}
        className={`block cursor-grab rounded-md border px-2 py-1.5 text-xs shadow-sm active:cursor-grabbing ${jobStatusBlockClass[job.status as keyof typeof jobStatusBlockClass] ?? ""}`}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="font-medium">{job.jobNumber}</p>
          {forecast && (
            <span className="shrink-0 text-[10px] opacity-80" title={`${Math.round(forecast.temperatureMaxC)}°C max`}>
              {weatherIcon(forecast.weatherCode)} {Math.round(forecast.temperatureMaxC)}°
            </span>
          )}
        </div>
        <p className="truncate">{job.customer.name}</p>
        {!compact && job.scheduledStart && job.scheduledEnd && (
          <p className="text-[10px] opacity-80">
            {new Date(job.scheduledStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–
            {new Date(job.scheduledEnd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {job.property && <p className="truncate text-[10px] opacity-80">{job.property.postcode}</p>}
        {rainy && (
          <p
            className={`mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium ${
              job.isExternal
                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            }`}
          >
            <CloudRain className="h-3 w-3 shrink-0" />
            {job.isExternal ? "Rain forecast — external job at risk" : "Rain likely"}
          </p>
        )}
      </Link>
    </div>
  );
}

function Cell({
  technicianId,
  date,
  jobs,
  jobForecastByJobId,
}: {
  technicianId: string;
  date: Date;
  jobs: CalendarJobItem[];
  jobForecastByJobId: Record<string, DailyForecast>;
}) {
  const id = `cell:${technicianId}:${dateKey(date)}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[70px] space-y-1 rounded-md border border-dashed p-1.5 ${isOver ? "bg-accent" : ""}`}>
      {jobs.map((j) => <JobBlock key={j.id} job={j} forecast={jobForecastByJobId[j.id]} />)}
    </div>
  );
}

function Tray({ jobs }: { jobs: CalendarJobItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <div ref={setNodeRef} className={`min-h-[120px] space-y-2 rounded-lg border p-2 ${isOver ? "bg-accent" : "bg-muted/30"}`}>
      {jobs.length === 0 ? (
        <p className="p-2 text-xs text-muted-foreground">Nothing unscheduled.</p>
      ) : (
        jobs.map((j) => <JobBlock key={j.id} job={j} compact />)
      )}
    </div>
  );
}

export function CalendarBoard({
  days,
  technicians,
  scheduled,
  unscheduled,
  weather,
}: {
  days: Date[];
  technicians: TechnicianOption[];
  scheduled: CalendarJobItem[];
  unscheduled: CalendarJobItem[];
  weather: CalendarWeather;
}) {
  const [jobs, setJobs] = useState<Record<string, CalendarJobItem>>(() =>
    Object.fromEntries([...scheduled, ...unscheduled].map((j) => [j.id, j]))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const jobId = String(active.id);
    const overId = String(over.id);

    if (overId === "tray") {
      setJobs((prev) => ({ ...prev, [jobId]: { ...prev[jobId], scheduledStart: null, scheduledEnd: null, technicianId: null } }));
      scheduleJobAction(jobId, null, null).catch(() => {
        // Best-effort — a page refresh will reconcile state if this ever fails.
      });
      return;
    }

    if (overId.startsWith("cell:")) {
      const [, technicianId, dateISO] = overId.split(":");
      setJobs((prev) => {
        const current = prev[jobId];
        const start = new Date(dateISO);
        start.setHours(9, 0, 0, 0);
        return { ...prev, [jobId]: { ...current, technicianId, scheduledStart: start } };
      });
      scheduleJobAction(jobId, technicianId, dateISO).catch(() => {
        // Best-effort — a page refresh will reconcile state if this ever fails.
      });
    }
  }

  const unscheduledJobs = Object.values(jobs).filter((j) => !j.scheduledStart || !j.technicianId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Unscheduled</h3>
          <Tray jobs={unscheduledJobs} />
        </div>

        <div className="overflow-x-auto">
          {technicians.length === 0 ? (
            <p className="text-sm text-muted-foreground">No technicians yet — seed sample staff or add one via Settings.</p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: `140px repeat(${days.length}, minmax(140px, 1fr))` }}>
              <div />
              {days.map((d) => {
                const areaForecast = weather.areaForecastByDate[dateKey(d)];
                return (
                  <div key={dateKey(d)} className="text-center text-xs font-medium text-muted-foreground">
                    <div>{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</div>
                    {areaForecast && (
                      <div className="text-[10px] font-normal opacity-80">
                        {weatherIcon(areaForecast.weatherCode)} {Math.round(areaForecast.temperatureMaxC)}°C
                      </div>
                    )}
                  </div>
                );
              })}

              {technicians.map((tech) => (
                <div key={tech.id} className="contents">
                  <div className="flex items-center text-sm font-medium">{tech.name}</div>
                  {days.map((d) => {
                    const dayJobs = Object.values(jobs).filter(
                      (j) => j.technicianId === tech.id && j.scheduledStart && sameDay(j.scheduledStart, d)
                    );
                    return (
                      <Cell
                        key={`${tech.id}-${dateKey(d)}`}
                        technicianId={tech.id}
                        date={d}
                        jobs={dayJobs}
                        jobForecastByJobId={weather.jobForecastByJobId}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay>{activeId && jobs[activeId] ? <JobBlock job={jobs[activeId]} /> : null}</DragOverlay>
    </DndContext>
  );
}
