import { Badge } from "@/components/ui/badge";
import { marketingChannelLabels, marketingToneLabels } from "@/validators/marketing";
import type { CampaignListItem } from "@/services/marketing.service";

export function CampaignHistory({ campaigns }: { campaigns: CampaignListItem[] }) {
  if (campaigns.length === 0) return <p className="text-sm text-muted-foreground">No campaign drafts yet.</p>;

  return (
    <ul className="space-y-2">
      {campaigns.map((c) => (
        <li key={c.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{c.name}</p>
            <Badge variant="outline">{marketingChannelLabels[c.channel as keyof typeof marketingChannelLabels] ?? c.channel}</Badge>
            {c.tone && <Badge variant="secondary">{marketingToneLabels[c.tone as keyof typeof marketingToneLabels] ?? c.tone}</Badge>}
            {c.aiGenerated && <Badge variant="outline">AI draft</Badge>}
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{c.content}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-GB")}</p>
        </li>
      ))}
    </ul>
  );
}
