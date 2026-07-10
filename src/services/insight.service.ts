import { db } from "@/lib/db";
import { ORG_ID, getOrgSettings } from "@/lib/settings";
import { isAiConfigured, getAiProvider } from "@/lib/ai";
import { formatGBP } from "@/lib/utils";
import {
  topColours,
  topProducts,
  mostProfitableServices,
  avgJobValue,
  repeatCustomerPct,
  technicianPerformance,
  leadConversion,
  revenueByMonth,
} from "@/services/analytics.service";

// ---------------------------------------------------------------------------
// Job health score — a deterministic, explainable stand-in for the fuller
// scoring pass reserved on JobHealthScore. Feeds the "due follow-up" /
// "likely to rebook" quick stats below; no AI involved in computing it.
// ---------------------------------------------------------------------------

const WET_AREAS = ["BATHROOM", "ENSUITE", "KITCHEN"];

export async function computeJobHealthScores(): Promise<void> {
  const org = await getOrgSettings();
  const jobs = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED", actualEnd: { not: null } },
    select: {
      id: true,
      actualEnd: true,
      satisfactionRating: true,
      warranty: { select: { endDate: true } },
      materials: { take: 1, select: { applicationArea: true } },
    },
  });

  const now = new Date();
  for (const job of jobs) {
    if (!job.actualEnd) continue;

    const monthsSince = Math.max(0, (now.getTime() - job.actualEnd.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    const expectedInterval = org.defaultReminderMonths > 0 ? org.defaultReminderMonths : 12;
    const area = job.materials[0]?.applicationArea ?? null;
    // Wetter, high-use areas wear faster than the standard interval assumes.
    const environmentWeight = area && WET_AREAS.includes(area) ? 1.15 : 1;
    const ratio = (monthsSince / expectedInterval) * environmentWeight;

    const band = ratio >= 1 ? "RED" : ratio >= 0.75 ? "YELLOW" : "GREEN";
    const score = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
    const warrantyActive = job.warranty ? job.warranty.endDate > now : false;

    const factors = {
      monthsSince: +monthsSince.toFixed(1),
      expectedInterval,
      environmentWeight,
      warrantyActive,
      satisfactionRating: job.satisfactionRating,
    };

    await db.jobHealthScore.upsert({
      where: { jobId: job.id },
      update: { score, band, factors, computedAt: now },
      create: { jobId: job.id, score, band, factors },
    });
  }
}

export type QuickStats = { dueFollowUpCount: number; likelyToRebookCount: number };

export async function getQuickStats(): Promise<QuickStats> {
  const [dueFollowUpCount, approachingHealthy] = await Promise.all([
    db.marketingReminder.count({ where: { organisationId: ORG_ID, status: "SCHEDULED", dueDate: { lte: new Date() } } }),
    db.jobHealthScore.findMany({
      where: { band: "YELLOW", job: { organisationId: ORG_ID, satisfactionRating: { gte: 4 }, customer: { deletedAt: null } } },
      select: { jobId: true },
    }),
  ]);
  return { dueFollowUpCount, likelyToRebookCount: approachingHealthy.length };
}

// ---------------------------------------------------------------------------
// Weekly digest + AI (or fallback) narrative
// ---------------------------------------------------------------------------

type WeeklyDigest = {
  revenue: { thisWeek: number; lastMonth: number };
  jobsCompletedThisWeek: number;
  topColours: Array<{ colour: string; count: number }>;
  topProducts: Array<{ product: string; count: number }>;
  mostProfitableServices: Array<{ serviceType: string; avgPrice: number; jobCount: number }>;
  avgJobValue: number;
  repeatCustomerPct: number;
  technicianPerformance: Array<{ name: string; jobsCompleted: number; avgSatisfaction: number | null }>;
  quickStats: QuickStats;
  leadConversion: { totalEnquiries: number; conversionPct: number };
};

async function buildWeeklyDigest(periodStart: Date, periodEnd: Date): Promise<WeeklyDigest> {
  const [weekRevenue, revenueMonths, jobsCompletedThisWeek, colours, products, services, avgValue, repeatPct, techPerf, quickStats, conversion] =
    await Promise.all([
      db.invoice.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: periodStart }, customer: { organisationId: ORG_ID }, deletedAt: null } }),
      revenueByMonth(1),
      db.job.count({ where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED", actualEnd: { gte: periodStart } } }),
      topColours(5),
      topProducts(5),
      mostProfitableServices(),
      avgJobValue(),
      repeatCustomerPct(),
      technicianPerformance(),
      getQuickStats(),
      leadConversion(),
    ]);

  return {
    revenue: { thisWeek: Number(weekRevenue._sum.amount ?? 0), lastMonth: revenueMonths[0]?.revenue ?? 0 },
    jobsCompletedThisWeek,
    topColours: colours.map((c) => ({ colour: c.colour, count: c.count })),
    topProducts: products.map((p) => ({ product: p.product, count: p.count })),
    mostProfitableServices: services.slice(0, 5).map((s) => ({ serviceType: s.serviceType, avgPrice: s.avgPrice, jobCount: s.jobCount })),
    avgJobValue: avgValue,
    repeatCustomerPct: repeatPct,
    technicianPerformance: techPerf.slice(0, 5),
    quickStats,
    leadConversion: { totalEnquiries: conversion.totalEnquiries, conversionPct: conversion.conversionPct },
  };
}

function buildFallbackSummary(digest: WeeklyDigest): string {
  const lines: string[] = [];
  lines.push(`This week: ${digest.jobsCompletedThisWeek} job(s) completed, ${formatGBP(digest.revenue.thisWeek)} collected.`);
  if (digest.topColours[0]) lines.push(`Most-used colour: ${digest.topColours[0].colour} (${digest.topColours[0].count} uses).`);
  if (digest.mostProfitableServices[0]) {
    lines.push(`Highest average job value: ${digest.mostProfitableServices[0].serviceType} at ${formatGBP(digest.mostProfitableServices[0].avgPrice)}.`);
  }
  if (digest.technicianPerformance[0]) {
    lines.push(`Busiest technician: ${digest.technicianPerformance[0].name} (${digest.technicianPerformance[0].jobsCompleted} completed jobs).`);
  }
  lines.push(
    `${digest.quickStats.dueFollowUpCount} customer(s) are due a follow-up reminder and ${digest.quickStats.likelyToRebookCount} look likely to rebook soon.`
  );
  lines.push(`Repeat customer rate: ${digest.repeatCustomerPct}%. Average job value: ${formatGBP(digest.avgJobValue)}.`);
  lines.push("Enable AI (set AI_API_KEY) for a fuller narrative report and revenue forecast.");
  return lines.join(" ");
}

export async function generateWeeklyInsightReport(): Promise<{ id: string }> {
  await computeJobHealthScores();

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 7);

  const digest = await buildWeeklyDigest(periodStart, periodEnd);

  let summary: string;
  if (isAiConfigured()) {
    try {
      const provider = getAiProvider();
      const periodLabel = `${periodStart.toLocaleDateString("en-GB")} - ${periodEnd.toLocaleDateString("en-GB")}`;
      summary = await provider.generateBusinessInsight({ periodLabel, digest });
    } catch (err) {
      console.error("AI insight generation failed, falling back to a computed summary", err);
      summary = buildFallbackSummary(digest);
    }
  } else {
    summary = buildFallbackSummary(digest);
  }

  const report = await db.insightReport.create({
    data: { organisationId: ORG_ID, periodStart, periodEnd, summary, data: digest },
    select: { id: true },
  });

  return report;
}

// ---------------------------------------------------------------------------
// Report history
// ---------------------------------------------------------------------------

export type InsightReportListItem = { id: string; periodStart: Date; periodEnd: Date; summary: string; createdAt: Date };

export async function listInsightReports(limit = 12): Promise<InsightReportListItem[]> {
  return db.insightReport.findMany({
    where: { organisationId: ORG_ID },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, periodStart: true, periodEnd: true, summary: true, createdAt: true },
  });
}

export type InsightReportDetail = InsightReportListItem & { data: unknown };

export async function getLatestInsightReport(): Promise<InsightReportDetail | null> {
  const row = await db.insightReport.findFirst({
    where: { organisationId: ORG_ID },
    orderBy: { createdAt: "desc" },
  });
  return row as InsightReportDetail | null;
}
