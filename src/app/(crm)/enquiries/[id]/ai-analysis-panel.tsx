"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Sparkles, RefreshCw, FileText, ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { conditionLevels, conditionLabels, findingLabels } from "@/validators/ai-analysis";
import { runAiAnalysisAction, updateAiAnalysisFieldsAction, type AiFieldsFormState } from "../actions";
import type { RunAnalysisResult } from "@/services/ai.service";
import type { Findings } from "@/lib/ai/provider";

export type Analysis = {
  id: string;
  findings: Findings;
  jobSummary: string;
  estimatedWork: string;
  estimatedMetres: unknown;
  suggestedProducts: Array<{ label: string }>;
  suggestedColours: string[];
  suggestedLabourHrs: unknown;
  quoteNotes: string | null;
  confidence: number;
  model: string;
  editedByUser: boolean;
};

type ProductOption = { id: string; manufacturer: string; name: string; colour: string };

function conditionDotClass(level: "good" | "fair" | "poor") {
  return level === "good" ? "bg-emerald-500" : level === "fair" ? "bg-amber-500" : "bg-red-600";
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>;
}

function RunAnalysisButton({ enquiryId, label }: { enquiryId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<RunAnalysisResult | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => setStatus(await runAiAnalysisAction(enquiryId)))}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} /> {pending ? "Analysing…" : label}
      </Button>
      {status && status.status !== "ok" && <p className="text-xs text-muted-foreground">{status.message}</p>}
    </div>
  );
}

function ChipList({ items, onAdd, onRemove, options, placeholder }: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  options: ComboboxOption[];
  placeholder: string;
}) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
      </div>
      <div className="flex gap-2">
        <Combobox
          options={options}
          value={text}
          placeholder={placeholder}
          onChange={setText}
          onSelect={(opt) => {
            onAdd(opt.label);
            setText("");
          }}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (text.trim()) {
              onAdd(text.trim());
              setText("");
            }
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function AiAnalysisPanel({
  enquiryId,
  analysis,
  pendingTask,
  configured,
  photosAvailable,
  hasPhotos,
  products,
}: {
  enquiryId: string;
  analysis: Analysis | null;
  pendingTask: { attempts: number; lastError: string | null } | null;
  configured: boolean;
  photosAvailable: boolean;
  hasPhotos: boolean;
  products: ProductOption[];
}) {
  const productOptions: ComboboxOption[] = products.map((p) => ({
    value: p.id,
    label: `${p.manufacturer} ${p.name} — ${p.colour}`,
  }));
  const colourOptions: ComboboxOption[] = products.map((p) => ({ value: p.id, label: p.colour }));

  if (!analysis) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand-plum" /> AI analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!configured ? (
            <p className="text-sm text-muted-foreground">
              AI analysis isn&apos;t configured yet — set <code>AI_PROVIDER</code>, <code>AI_API_KEY</code> and <code>AI_MODEL</code> to enable it.
            </p>
          ) : (
            <>
              {pendingTask ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Queued — the last attempt failed and will retry automatically ({pendingTask.attempts} attempt{pendingTask.attempts === 1 ? "" : "s"} so far).
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No analysis yet — run it to get a draft estimate.</p>
              )}
              {!photosAvailable && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ImageOff className="h-3.5 w-3.5" />
                  {hasPhotos ? "Photos aren't wired to storage yet — analysis will use the description only." : "No photos on this enquiry — analysis will use the description only."}
                </p>
              )}
              <RunAnalysisButton enquiryId={enquiryId} label={pendingTask ? "Try again" : "Run AI analysis"} />
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand-plum" /> AI analysis
          </CardTitle>
          <RunAnalysisButton enquiryId={enquiryId} label="Re-run" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Draft estimate from {analysis.model} — a starting point for a human to review, not a binding quote.
          {analysis.editedByUser && " Edited by a staff member since it was generated."}
        </p>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Confidence</span>
            <span>{analysis.confidence}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", analysis.confidence >= 70 ? "bg-emerald-500" : analysis.confidence >= 40 ? "bg-amber-500" : "bg-red-600")}
              style={{ width: `${analysis.confidence}%` }}
            />
          </div>
        </div>

        <AiFieldsForm enquiryId={enquiryId} analysis={analysis} productOptions={productOptions} colourOptions={colourOptions} />

        <div className="border-t pt-4">
          <Button type="button" disabled className="w-full">
            <FileText className="h-4 w-4" /> Create quote from this — available in Milestone 4
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AiFieldsForm({
  enquiryId,
  analysis,
  productOptions,
  colourOptions,
}: {
  enquiryId: string;
  analysis: Analysis;
  productOptions: ComboboxOption[];
  colourOptions: ComboboxOption[];
}) {
  const action = updateAiAnalysisFieldsAction.bind(null, enquiryId);
  const [state, formAction] = useFormState<AiFieldsFormState, FormData>(action, null);

  const [colours, setColours] = useState<string[]>(analysis.suggestedColours);
  const [suggestedProducts, setSuggestedProducts] = useState<string[]>(analysis.suggestedProducts.map((p) => p.label));
  const f = analysis.findings;
  const findingKeys = Object.keys(findingLabels) as Array<keyof typeof findingLabels>;
  const hasAnyIssue = findingKeys.some((key) => f[key]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Detected issues</p>
        <div className="flex flex-wrap gap-1.5">
          {findingKeys.map((key) =>
            f[key] ? (
              <span key={key} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                {findingLabels[key]}
              </span>
            ) : null
          )}
          {!hasAnyIssue && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              No issues detected
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            <span className={cn("h-1.5 w-1.5 rounded-full", conditionDotClass(f.groutCondition))} /> Grout: {conditionLabels[f.groutCondition]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            <span className={cn("h-1.5 w-1.5 rounded-full", conditionDotClass(f.cleanliness))} /> Cleanliness: {conditionLabels[f.cleanliness]}
          </span>
          {f.safetyIssues.map((s) => (
            <span key={s} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
              ⚠ {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["mould", "missingSilicone", "crackedSilicone", "waterIngress", "tileGaps"] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox name={key} defaultChecked={f[key]} /> {findingLabels[key]}
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="groutCondition">Grout condition</Label>
          <Select id="groutCondition" name="groutCondition" defaultValue={f.groutCondition}>
            {conditionLevels.map((c) => <option key={c} value={c}>{conditionLabels[c]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cleanliness">Cleanliness</Label>
          <Select id="cleanliness" name="cleanliness" defaultValue={f.cleanliness}>
            {conditionLevels.map((c) => <option key={c} value={c}>{conditionLabels[c]}</option>)}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="safetyIssues">Safety issues (one per line)</Label>
        <Textarea id="safetyIssues" name="safetyIssues" rows={2} defaultValue={f.safetyIssues.join("\n")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="jobSummary">Job summary</Label>
        <Textarea id="jobSummary" name="jobSummary" rows={2} defaultValue={analysis.jobSummary} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="estimatedWork">Estimated work</Label>
        <Textarea id="estimatedWork" name="estimatedWork" rows={3} defaultValue={analysis.estimatedWork} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="estimatedMetres">Estimated silicone (metres)</Label>
          <Input id="estimatedMetres" name="estimatedMetres" type="number" min="0" step="0.1" defaultValue={analysis.estimatedMetres != null ? Number(analysis.estimatedMetres) : ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suggestedLabourHrs">Estimated labour (hours)</Label>
          <Input id="suggestedLabourHrs" name="suggestedLabourHrs" type="number" min="0" step="0.25" defaultValue={analysis.suggestedLabourHrs != null ? Number(analysis.suggestedLabourHrs) : ""} />
        </div>
      </div>

      <div>
        <Label>Suggested products</Label>
        <div className="mt-1.5">
          <ChipList
            items={suggestedProducts}
            onAdd={(v) => setSuggestedProducts((p) => [...p, v])}
            onRemove={(v) => setSuggestedProducts((p) => p.filter((x) => x !== v))}
            options={productOptions}
            placeholder="Pick from catalogue or type a product"
          />
        </div>
        {suggestedProducts.map((p) => <input key={p} type="hidden" name="suggestedProducts" value={p} />)}
      </div>

      <div>
        <Label>Suggested colours</Label>
        <div className="mt-1.5">
          <ChipList
            items={colours}
            onAdd={(v) => setColours((c) => [...c, v])}
            onRemove={(v) => setColours((c) => c.filter((x) => x !== v))}
            options={colourOptions}
            placeholder="Pick from catalogue or type a colour"
          />
        </div>
        {colours.map((c) => <input key={c} type="hidden" name="suggestedColours" value={c} />)}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quoteNotes">Quote notes</Label>
        <Textarea id="quoteNotes" name="quoteNotes" rows={2} defaultValue={analysis.quoteNotes ?? ""} />
      </div>

      {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
      <SaveButton />
    </form>
  );
}
