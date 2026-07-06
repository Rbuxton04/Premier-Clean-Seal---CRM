import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGBP } from "@/lib/utils";
import { isAiConfigured } from "@/lib/ai";
import { getMarketingStats, listUpcomingReminders, listCampaigns } from "@/services/marketing.service";
import type { MarketingStats, ReminderListItem, CampaignListItem } from "@/services/marketing.service";
import { RemindersTable } from "./reminders-table";
import { RunRemindersButton } from "./run-reminders-button";
import { CampaignWriter } from "./campaign-writer";
import { CampaignHistory } from "./campaign-history";

export const dynamic = "force-dynamic";

async function loadDashboard() {
  try {
    const [stats, reminders, campaigns] = await Promise.all([getMarketingStats(), listUpcomingReminders(20), listCampaigns()]);
    return { stats, reminders, campaigns, dbOnline: true };
  } catch {
    return { stats: null as MarketingStats | null, reminders: [] as ReminderListItem[], campaigns: [] as CampaignListItem[], dbOnline: false };
  }
}

export default async function MarketingPage() {
  const { stats, reminders, campaigns, dbOnline } = await loadDashboard();

  const statCard = (label: string, value: string) => (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Marketing</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        {dbOnline && <RunRemindersButton />}
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {statCard("Sent", String(stats.sentCount))}
            {statCard("Open rate", `${stats.openRate}%`)}
            {statCard("Click rate", `${stats.clickRate}%`)}
            {statCard("Replies", String(stats.repliesCount))}
            {statCard("Conversions", String(stats.conversionsCount))}
            {statCard("Repeat revenue", formatGBP(stats.repeatRevenue))}
            {statCard("Repeat customers", String(stats.repeatCustomersCount))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <RemindersTable reminders={reminders} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI writer &amp; campaign drafts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <CampaignWriter aiConfigured={isAiConfigured()} />
              <CampaignHistory campaigns={campaigns} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
