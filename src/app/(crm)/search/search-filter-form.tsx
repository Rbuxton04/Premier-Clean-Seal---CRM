"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { searchEntities, searchEntityLabels, type SearchEntity, type SearchQuery } from "@/validators/search";
import { workTypes, workTypeLabels, enquiryStages, enquiryStageLabels } from "@/validators/enquiry";
import { applicationAreas, applicationAreaLabels } from "@/validators/completion";
import { propertyTypes, propertyTypeLabels } from "@/validators/customer";
import { jobStatuses, jobStatusLabels } from "@/validators/job";

type FormState = {
  entity: SearchEntity;
  workType: string;
  applicationArea: string;
  propertyType: string;
  tag: string;
  colour: string;
  product: string;
  manufacturer: string;
  technician: string;
  status: string;
  mouldFound: boolean;
  dueFollowUp: boolean;
  completedBefore: string;
  completedAfter: string;
  createdBefore: string;
  createdAfter: string;
  postcodeStartsWith: string;
  textContains: string;
  sort: "newest" | "oldest";
};

function toFormState(initial?: Partial<SearchQuery>): FormState {
  const f = initial?.filters;
  return {
    entity: initial?.entity ?? "jobs",
    workType: f?.workType ?? "",
    applicationArea: f?.applicationArea ?? "",
    propertyType: f?.propertyType ?? "",
    tag: f?.tag ?? "",
    colour: f?.colour ?? "",
    product: f?.product ?? "",
    manufacturer: f?.manufacturer ?? "",
    technician: f?.technician ?? "",
    status: f?.status ?? "",
    mouldFound: f?.mouldFound ?? false,
    dueFollowUp: f?.dueFollowUp ?? false,
    completedBefore: f?.completedBefore ? new Date(f.completedBefore).toISOString().slice(0, 10) : "",
    completedAfter: f?.completedAfter ? new Date(f.completedAfter).toISOString().slice(0, 10) : "",
    createdBefore: f?.createdBefore ? new Date(f.createdBefore).toISOString().slice(0, 10) : "",
    createdAfter: f?.createdAfter ? new Date(f.createdAfter).toISOString().slice(0, 10) : "",
    postcodeStartsWith: f?.postcodeStartsWith ?? "",
    textContains: f?.textContains ?? "",
    sort: initial?.sort ?? "newest",
  };
}

function toQuery(s: FormState): SearchQuery {
  return {
    entity: s.entity,
    sort: s.sort,
    filters: {
      workType: s.workType || undefined,
      applicationArea: s.applicationArea || undefined,
      propertyType: s.propertyType || undefined,
      tag: s.tag || undefined,
      colour: s.colour || undefined,
      product: s.product || undefined,
      manufacturer: s.manufacturer || undefined,
      technician: s.technician || undefined,
      status: s.status || undefined,
      mouldFound: s.mouldFound || undefined,
      dueFollowUp: s.dueFollowUp || undefined,
      completedBefore: s.completedBefore ? new Date(s.completedBefore) : undefined,
      completedAfter: s.completedAfter ? new Date(s.completedAfter) : undefined,
      createdBefore: s.createdBefore ? new Date(s.createdBefore) : undefined,
      createdAfter: s.createdAfter ? new Date(s.createdAfter) : undefined,
      postcodeStartsWith: s.postcodeStartsWith || undefined,
      textContains: s.textContains || undefined,
    },
  };
}

export function SearchFilterForm({
  initial,
  tags,
  technicians,
  pending,
  onSubmit,
}: {
  initial?: Partial<SearchQuery>;
  tags: string[];
  technicians: string[];
  pending: boolean;
  onSubmit: (query: SearchQuery) => void;
}) {
  const [state, setState] = useState<FormState>(() => toFormState(initial));

  const tagOptions: ComboboxOption[] = tags.map((t) => ({ value: t, label: t }));
  const technicianOptions: ComboboxOption[] = technicians.map((t) => ({ value: t, label: t }));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="space-y-4 rounded-lg border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(toQuery(state));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Looking for</Label>
          <Select value={state.entity} onChange={(e) => set("entity", e.target.value as SearchEntity)}>
            {searchEntities.map((e) => (
              <option key={e} value={e}>
                {searchEntityLabels[e]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Keyword contains</Label>
          <Input value={state.textContains} onChange={(e) => set("textContains", e.target.value)} placeholder="Any free text…" />
        </div>
      </div>

      {state.entity === "jobs" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={state.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">Any</option>
              {jobStatuses.map((s) => (
                <option key={s} value={s}>
                  {jobStatusLabels[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Area</Label>
            <Select value={state.applicationArea} onChange={(e) => set("applicationArea", e.target.value)}>
              <option value="">Any</option>
              {applicationAreas.map((a) => (
                <option key={a} value={a}>
                  {applicationAreaLabels[a]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Technician</Label>
            <Combobox options={technicianOptions} value={state.technician} placeholder="Any" onChange={(v) => set("technician", v)} onSelect={(o) => set("technician", o.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <Input value={state.colour} onChange={(e) => set("colour", e.target.value)} placeholder="e.g. Jasmine White" />
          </div>
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Input value={state.product} onChange={(e) => set("product", e.target.value)} placeholder="e.g. 785+" />
          </div>
          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Input value={state.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Dow" />
          </div>
          <div className="space-y-1.5">
            <Label>Completed after</Label>
            <Input type="date" value={state.completedAfter} onChange={(e) => set("completedAfter", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Completed before</Label>
            <Input type="date" value={state.completedBefore} onChange={(e) => set("completedBefore", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Postcode starts with</Label>
            <Input value={state.postcodeStartsWith} onChange={(e) => set("postcodeStartsWith", e.target.value)} placeholder="e.g. WN1" />
          </div>
        </div>
      )}

      {state.entity === "customers" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tag</Label>
            <Combobox options={tagOptions} value={state.tag} placeholder="Any" onChange={(v) => set("tag", v)} onSelect={(o) => set("tag", o.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select value={state.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
              <option value="">Any</option>
              {propertyTypes.map((p) => (
                <option key={p} value={p}>
                  {propertyTypeLabels[p]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Postcode starts with</Label>
            <Input value={state.postcodeStartsWith} onChange={(e) => set("postcodeStartsWith", e.target.value)} placeholder="e.g. WN1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={state.dueFollowUp} onChange={(e) => set("dueFollowUp", e.target.checked)} />
            Due a follow-up now
          </label>
        </div>
      )}

      {state.entity === "properties" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select value={state.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
              <option value="">Any</option>
              {propertyTypes.map((p) => (
                <option key={p} value={p}>
                  {propertyTypeLabels[p]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Postcode starts with</Label>
            <Input value={state.postcodeStartsWith} onChange={(e) => set("postcodeStartsWith", e.target.value)} placeholder="e.g. WN1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={state.mouldFound} onChange={(e) => set("mouldFound", e.target.checked)} />
            Mould found
          </label>
        </div>
      )}

      {state.entity === "enquiries" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Work type</Label>
            <Select value={state.workType} onChange={(e) => set("workType", e.target.value)}>
              <option value="">Any</option>
              {workTypes.map((w) => (
                <option key={w} value={w}>
                  {workTypeLabels[w]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={state.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">Any</option>
              {enquiryStages.map((s) => (
                <option key={s} value={s}>
                  {enquiryStageLabels[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Postcode starts with</Label>
            <Input value={state.postcodeStartsWith} onChange={(e) => set("postcodeStartsWith", e.target.value)} placeholder="e.g. WN1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={state.mouldFound} onChange={(e) => set("mouldFound", e.target.checked)} />
            Mould found
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Sort:</span>
          <Select value={state.sort} onChange={(e) => set("sort", e.target.value as "newest" | "oldest")} className="h-7 w-auto">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </div>
      </div>
    </form>
  );
}
