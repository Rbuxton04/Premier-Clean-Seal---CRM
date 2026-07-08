import { db } from "@/lib/db";

// Leigh/Wigan — used as the calendar's general-area forecast (day headers)
// and as the fallback location for any job whose property has no cached
// coordinates yet.
export const DEFAULT_LAT = 53.4975;
export const DEFAULT_LNG = -2.5178;

// Open-Meteo's daily forecast is reliable roughly this far out; beyond it we
// show a neutral "no forecast yet" state rather than guessing.
const FORECAST_WINDOW_DAYS = 14;

// A forecast doesn't meaningfully change hour to hour, so a cached entry is
// reused for this long before Open-Meteo is queried again for the same
// rounded location + date — keeps calls well within the free tier.
const CACHE_TTL_HOURS = 6;

// A job block gets a rain warning at/above this forecast probability (%),
// or on a meaningful accumulated total even if the probability figure is
// lower (e.g. a short but heavy shower).
export const RAIN_PROBABILITY_THRESHOLD = 60;
const RAIN_SUM_THRESHOLD_MM = 4;

export type DailyForecast = {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationProbabilityMax: number;
  precipitationSumMm: number;
};

export type WeatherLocation = { latitude: number; longitude: number };

/** Round to ~1.1km so nearby job locations share one cache entry/API call. */
function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWithinForecastWindow(dateISO: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateISO);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= FORECAST_WINDOW_DAYS;
}

export function isRainLikely(forecast: DailyForecast | null | undefined): boolean {
  if (!forecast) return false;
  return forecast.precipitationProbabilityMax >= RAIN_PROBABILITY_THRESHOLD || forecast.precipitationSumMm >= RAIN_SUM_THRESHOLD_MM;
}

type WeatherCacheRow = {
  date: Date;
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationProbabilityMax: number;
  precipitationSumMm: number;
  fetchedAt: Date;
};

function rowToForecast(row: WeatherCacheRow): DailyForecast {
  return {
    date: dateKey(row.date),
    weatherCode: row.weatherCode,
    temperatureMaxC: row.temperatureMaxC,
    temperatureMinC: row.temperatureMinC,
    precipitationProbabilityMax: row.precipitationProbabilityMax,
    precipitationSumMm: row.precipitationSumMm,
  };
}

/**
 * Returns a date -> forecast map for a location, covering whichever of
 * `dateISOs` fall inside Open-Meteo's ~14-day window (dates outside it are
 * simply absent from the result — callers treat a missing entry as "no
 * forecast yet", never an error). Reads/writes the WeatherCache table keyed
 * by rounded coordinate + date so the same location is never re-queried
 * from Open-Meteo more than once every few hours. Never throws — a
 * malfunctioning weather layer must not be able to break the calendar.
 */
export async function getForecastForLocation(location: WeatherLocation, dateISOs: string[]): Promise<Map<string, DailyForecast>> {
  const result = new Map<string, DailyForecast>();
  const wantedDates = Array.from(new Set(dateISOs.filter(isWithinForecastWindow)));
  if (wantedDates.length === 0) return result;

  const latitude = roundCoord(location.latitude);
  const longitude = roundCoord(location.longitude);

  try {
    const cached = await db.weatherCache.findMany({
      where: { latitude, longitude, date: { in: wantedDates.map((d) => new Date(d)) } },
    });
    const freshCutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
    const cacheByDate = new Map(cached.map((row) => [dateKey(row.date), row]));

    cacheByDate.forEach((row, date) => {
      if (row.fetchedAt >= freshCutoff) result.set(date, rowToForecast(row));
    });

    const missingDates = wantedDates.filter((d) => !result.has(d));
    if (missingDates.length === 0) return result;

    const fetched = await fetchOpenMeteo(latitude, longitude);
    if (!fetched) {
      // Open-Meteo unreachable/rate-limited — serve whatever's cached, even
      // if stale, rather than showing nothing for dates we've seen before.
      cacheByDate.forEach((row, date) => {
        if (!result.has(date)) result.set(date, rowToForecast(row));
      });
      return result;
    }

    for (const day of fetched) {
      if (!wantedDates.includes(day.date)) continue; // Open-Meteo returns its own window; only cache what was asked for.
      result.set(day.date, day);
      const data = {
        weatherCode: day.weatherCode,
        temperatureMaxC: day.temperatureMaxC,
        temperatureMinC: day.temperatureMinC,
        precipitationProbabilityMax: day.precipitationProbabilityMax,
        precipitationSumMm: day.precipitationSumMm,
      };
      await db.weatherCache.upsert({
        where: { latitude_longitude_date: { latitude, longitude, date: new Date(day.date) } },
        create: { latitude, longitude, date: new Date(day.date), ...data },
        update: { ...data, fetchedAt: new Date() },
      });
    }

    return result;
  } catch (err) {
    console.error("Weather lookup failed — hiding the weather layer for this location:", err);
    return result;
  }
}

async function fetchOpenMeteo(latitude: number, longitude: number): Promise<DailyForecast[] | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
    timezone: "Europe/London",
    forecast_days: String(FORECAST_WINDOW_DAYS + 1),
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Open-Meteo request failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      daily?: {
        time: string[];
        weathercode: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
        precipitation_sum: number[];
      };
    };
    if (!data.daily) return null;

    const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_probability_max, precipitation_sum } = data.daily;
    return time.map((date, i) => ({
      date,
      weatherCode: weathercode[i],
      temperatureMaxC: temperature_2m_max[i],
      temperatureMinC: temperature_2m_min[i],
      precipitationProbabilityMax: precipitation_probability_max[i],
      precipitationSumMm: precipitation_sum[i],
    }));
  } catch (err) {
    console.error("Open-Meteo request threw:", err);
    return null;
  }
}

export type CalendarWeather = {
  areaForecastByDate: Record<string, DailyForecast>;
  jobForecastByJobId: Record<string, DailyForecast>;
};

export type WeatherJobInput = {
  id: string;
  scheduledStart: Date | null;
  property: { latitude: number | null; longitude: number | null } | null;
};

/**
 * Builds the calendar's weather layer in one pass: a general area forecast
 * (Leigh/Wigan) for the day-column headers, plus a per-job forecast for
 * each scheduled job's own location (falling back to the area default when
 * a property has no cached coordinates). Jobs sharing a rounded coordinate
 * are grouped so they share one Open-Meteo/cache lookup rather than one
 * each. Never throws.
 */
export async function getCalendarWeather(dateISOs: string[], jobs: WeatherJobInput[]): Promise<CalendarWeather> {
  const areaForecastByDate: Record<string, DailyForecast> = {};
  const jobForecastByJobId: Record<string, DailyForecast> = {};

  const areaForecast = await getForecastForLocation({ latitude: DEFAULT_LAT, longitude: DEFAULT_LNG }, dateISOs);
  areaForecast.forEach((forecast, date) => {
    areaForecastByDate[date] = forecast;
  });

  const groups = new Map<string, { latitude: number; longitude: number; jobs: WeatherJobInput[] }>();
  for (const job of jobs) {
    if (!job.scheduledStart) continue;
    const latitude = job.property?.latitude ?? DEFAULT_LAT;
    const longitude = job.property?.longitude ?? DEFAULT_LNG;
    const key = `${roundCoord(latitude)}:${roundCoord(longitude)}`;
    const group = groups.get(key) ?? { latitude, longitude, jobs: [] };
    group.jobs.push(job);
    groups.set(key, group);
  }

  for (const group of Array.from(groups.values())) {
    const forecast = await getForecastForLocation({ latitude: group.latitude, longitude: group.longitude }, dateISOs);
    for (const job of group.jobs) {
      const date = job.scheduledStart ? dateKey(job.scheduledStart) : null;
      const dayForecast = date ? forecast.get(date) : undefined;
      if (dayForecast) jobForecastByJobId[job.id] = dayForecast;
    }
  }

  return { areaForecastByDate, jobForecastByJobId };
}
