import { cn } from "@/lib/utils";

export type SegmentCounts = { done: number; scheduled: number; snag: number; noAccess: number; notStarted: number };

/**
 * A single-row bar split into done/scheduled/snag/no-access/not-started
 * segments, proportional to their share of the total -- used by the group
 * index, the group page's property rows, and the property page's stat row.
 * Falls back to an empty grey track when there are no rooms yet, rather
 * than dividing by zero.
 */
export function SegmentedProgressBar({ counts, className }: { counts: SegmentCounts; className?: string }) {
  const total = counts.done + counts.scheduled + counts.snag + counts.noAccess + counts.notStarted;
  const segments: Array<{ key: string; value: number; className: string; label: string }> = [
    { key: "done", value: counts.done, className: "bg-brand-plum", label: "Done" },
    { key: "scheduled", value: counts.scheduled, className: "bg-sky-400", label: "Scheduled" },
    { key: "snag", value: counts.snag, className: "bg-amber-400", label: "Snag" },
    { key: "noAccess", value: counts.noAccess, className: "bg-muted-foreground/40", label: "No access" },
    { key: "notStarted", value: counts.notStarted, className: "bg-muted", label: "Not started" },
  ];

  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="img" aria-label={`${counts.done} of ${total} done`}>
      {total === 0
        ? null
        : segments
            .filter((s) => s.value > 0)
            .map((s) => <div key={s.key} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />)}
    </div>
  );
}
