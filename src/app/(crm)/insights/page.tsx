import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/ai";
import { listInsightReports, getQuickStats } from "@/services/insight.service";
import type { InsightReportListItem, QuickStats } from "@/services/insight.service";
import { GenerateInsightButton } from "./generate-insight-button";

export const dynamic = "force-dynamic";

async function loadInsights() {
  try {
    const [reports, quickStats] = await Promise.all([listInsightReports(20), getQuickStats()]);
    return { reports, quickStats, dbOnline: true };
  } catch {
    return { reports: [] as InsightReportListItem[], quickStats: null as QuickStats | null, dbOnline: false };
  }
}

export default async function InsightsPage() {
  const { reports, quickStats, dbOnline } = await loadInsights();
  const aiConfigured = isAiConfigured();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Insights</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        {dbOnline && <GenerateInsightButton />}
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          {!aiConfigured && (
            <Badge variant="warning">
              AI_API_KEY isn&apos;t set — reports use a computed stat summary rather than a full AI narrative. Charts and
              numbers are unaffected.
            </Badge>
          )}

          {quickStats && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due follow-up</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold">{quickStats.dueFollowUpCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely to rebook</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold">{quickStats.likelyToRebookCount}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Report history</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports yet — generate the first one above.</p>
              ) : (
                <ul className="space-y-4">
                  {reports.map((r) => (
                    <li key={r.id} className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.periodStart).toLocaleDateString("en-GB")} – {new Date(r.periodEnd).toLocaleDateString("en-GB")}
                        {" · "}Generated {new Date(r.createdAt).toLocaleDateString("en-GB")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{r.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
