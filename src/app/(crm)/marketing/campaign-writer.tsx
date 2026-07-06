"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { marketingTones, marketingToneLabels, marketingChannels, marketingChannelLabels } from "@/validators/marketing";
import { generateCampaignAction } from "./actions";

export function CampaignWriter({ aiConfigured }: { aiConfigured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [tone, setTone] = useState<(typeof marketingTones)[number]>("FRIENDLY");
  const [channel, setChannel] = useState<(typeof marketingChannels)[number]>("EMAIL");
  const [brief, setBrief] = useState("12-month reminder to reseal a bathroom");
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    if (!brief.trim()) {
      setError("Describe what this campaign is about.");
      return;
    }
    startTransition(async () => {
      const result = await generateCampaignAction({ tone, channel, brief });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setContent(result.content);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-brand-plum" /> AI marketing writer
      </p>
      {!aiConfigured && (
        <p className="text-xs text-muted-foreground">
          AI_API_KEY isn&apos;t set — set it to enable draft generation. The form still works so you can see how it&apos;ll look.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tone</Label>
          <Select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
            {marketingTones.map((t) => (
              <option key={t} value={t}>
                {marketingToneLabels[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            {marketingChannels.map((c) => (
              <option key={c} value={c}>
                {marketingChannelLabels[c]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>What&apos;s this campaign about?</Label>
        <Textarea rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" disabled={pending || !aiConfigured} onClick={generate}>
        {pending ? "Generating…" : "Generate draft"}
      </Button>

      {content && (
        <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
          {content}
          <p className="mt-2 text-xs text-muted-foreground">Saved as a draft below — review before using it anywhere.</p>
        </div>
      )}
    </div>
  );
}
