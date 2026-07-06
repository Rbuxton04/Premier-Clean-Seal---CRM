"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, X, ListFilter, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { describeQuery, searchEntityLabels, type SearchFilters, type SearchQuery } from "@/validators/search";
import type { SearchOutcome } from "@/services/search.service";
import { aiSearchAction, structuredSearchAction } from "./actions";
import { SearchFilterForm } from "./search-filter-form";
import { ResultsList } from "./result-cards";

const EXAMPLE_QUERIES = [
  "find all hotels",
  "every property with mould",
  "jobs using Dow 785 Jasmine White",
  "bathrooms completed over two years ago",
  "customers due a follow-up",
  "jobs completed by Danny last month",
];

function openAsListHref(query: SearchQuery): string | null {
  if (query.entity === "jobs") {
    const params = new URLSearchParams();
    if (query.filters.status) params.set("status", query.filters.status.toUpperCase());
    const qs = params.toString();
    return `/jobs${qs ? `?${qs}` : ""}`;
  }
  if (query.entity === "customers") {
    const params = new URLSearchParams();
    if (query.filters.textContains) params.set("q", query.filters.textContains);
    const qs = params.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  }
  return null;
}

export function SearchApp({ aiConfigured, tags, technicians }: { aiConfigured: boolean; tags: string[]; technicians: string[] }) {
  const [question, setQuestion] = useState("");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [showFilterForm, setShowFilterForm] = useState(!aiConfigured);
  const [pending, startTransition] = useTransition();

  function runAiSearch(q: string) {
    if (!q.trim()) return;
    setQuestion(q);
    startTransition(async () => {
      const result = await aiSearchAction(q);
      setOutcome(result);
      setShowFilterForm(false);
    });
  }

  function runStructured(query: SearchQuery) {
    startTransition(async () => {
      const result = await structuredSearchAction(query);
      setOutcome(result);
    });
  }

  function removeFilter(key: keyof SearchFilters) {
    if (!outcome) return;
    runStructured({ ...outcome.query, filters: { ...outcome.query.filters, [key]: undefined } });
  }

  const chips = outcome && !outcome.clarification ? describeQuery(outcome.query) : [];
  const listHref = outcome ? openAsListHref(outcome.query) : null;

  return (
    <div className="space-y-5">
      {aiConfigured ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runAiSearch(question);
          }}
        >
          <div className="relative flex-1 min-w-[240px]">
            <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-plum" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question, e.g. every bathroom we did in Jasmine White over two years ago…"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Searching…" : "Search"}
          </Button>
        </form>
      ) : (
        <Badge variant="warning">
          AI_API_KEY isn&apos;t set — natural-language questions aren&apos;t available, but the structured search below covers the
          same ground.
        </Badge>
      )}

      {!outcome && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {aiConfigured ? "Example questions" : "Tips"}
          </p>
          <div className="flex flex-wrap gap-2">
            {aiConfigured ? (
              EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => runAiSearch(q)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  {q}
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Pick what you&apos;re looking for and narrow it down with the filters.</p>
            )}
          </div>
        </div>
      )}

      {aiConfigured && (
        <button type="button" onClick={() => setShowFilterForm((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <ListFilter className="h-3.5 w-3.5" /> {showFilterForm ? "Hide filters" : outcome ? "Edit filters" : "Search with filters instead"}
        </button>
      )}

      {showFilterForm && (
        <SearchFilterForm initial={outcome?.query} tags={tags} technicians={technicians} pending={pending} onSubmit={runStructured} />
      )}

      {outcome?.clarification && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          {outcome.clarification}
        </div>
      )}

      {outcome && !outcome.clarification && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Understood as</span>
            <Badge>{searchEntityLabels[outcome.query.entity]}</Badge>
            {chips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                {chip.label}: {chip.value}
                <button type="button" onClick={() => removeFilter(chip.key)} aria-label={`Remove ${chip.label} filter`}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </span>
            ))}
            {!outcome.understood && <Badge variant="warning">Couldn&apos;t fully understand — keyword search shown instead</Badge>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {outcome.results.items.length} result{outcome.results.items.length === 1 ? "" : "s"}
            </p>
            {listHref && (
              <Link href={listHref} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Open as filtered list
              </Link>
            )}
          </div>

          <ResultsList results={outcome.results} />

          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try another</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.filter((q) => q !== question).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => runAiSearch(q)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                  disabled={!aiConfigured}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
