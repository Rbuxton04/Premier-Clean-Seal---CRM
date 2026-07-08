import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { listCalendarData } from "@/services/job.service";
import type { TechnicianOption, CalendarJobItem } from "@/services/job.service";
import { getCalendarWeather, type CalendarWeather } from "@/services/weather.service";
import { CalendarBoard } from "./calendar-board";

export const dynamic = "force-dynamic";

const EMPTY_WEATHER: CalendarWeather = { areaForecastByDate: {}, jobForecastByJobId: {} };

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function loadCalendar(weekStart: Date, weekEnd: Date) {
  try {
    const data = await listCalendarData(weekStart, weekEnd);
    return { ...data, dbOnline: true };
  } catch {
    return { technicians: [] as TechnicianOption[], scheduled: [] as CalendarJobItem[], unscheduled: [] as CalendarJobItem[], dbOnline: false };
  }
}

/** Weather is purely informational — any failure here just hides the layer, never the calendar itself. */
async function loadWeather(dateISOs: string[], scheduled: CalendarJobItem[]): Promise<CalendarWeather> {
  try {
    return await getCalendarWeather(dateISOs, scheduled);
  } catch {
    return EMPTY_WEATHER;
  }
}

export default async function CalendarPage({ searchParams }: { searchParams: { week?: string; weekends?: string } }) {
  const includeWeekends = searchParams.weekends === "1";
  const anchor = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = getMonday(anchor);
  const daysInView = includeWeekends ? 7 : 5;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const days = Array.from({ length: daysInView }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const thisWeek = getMonday(new Date());

  const { technicians, scheduled, unscheduled, dbOnline } = await loadCalendar(weekStart, weekEnd);
  const weather = dbOnline ? await loadWeather(days.map(toISODate), scheduled) : EMPTY_WEATHER;
  const weekendParam = includeWeekends ? "&weekends=1" : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Calendar</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link href={`/calendar?week=${toISODate(prevWeek)}${weekendParam}`} className="rounded-md border p-1.5 hover:bg-accent" aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href={`/calendar?week=${toISODate(thisWeek)}${weekendParam}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                This week
              </Link>
              <Link href={`/calendar?week=${toISODate(nextWeek)}${weekendParam}`} className="rounded-md border p-1.5 hover:bg-accent" aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Link>
              <span className="text-sm font-medium">
                {days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                {days[days.length - 1].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
            <Link
              href={`/calendar?week=${toISODate(weekStart)}${includeWeekends ? "" : "&weekends=1"}`}
              className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              {includeWeekends ? "Hide weekends" : "Show weekends"}
            </Link>
          </div>

          <CalendarBoard days={days} technicians={technicians} scheduled={scheduled} unscheduled={unscheduled} weather={weather} />
        </>
      )}
    </div>
  );
}
