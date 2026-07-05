"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { setCustomerTagsAction } from "../actions";
import { Button } from "@/components/ui/button";

type Tag = { id: string; name: string; colour: string };

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save tags"}</Button>;
}

export function TagsPanel({ customerId, allTags, assigned }: { customerId: string; allTags: Tag[]; assigned: string[] }) {
  const [selected, setSelected] = useState<string[]>(assigned);

  if (allTags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tags exist yet. <Link href="/settings/tags" className="text-primary underline">Create tags</Link> to organise clients into groups like Contractor or Domestic.
      </p>
    );
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <form action={setCustomerTagsAction.bind(null, customerId)} className="space-y-4">
      {selected.map((id) => <input key={id} type="hidden" name="tagIds" value={id} />)}
      <div className="flex flex-wrap gap-2">
        {allTags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className="inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-medium transition-all"
              style={on ? { backgroundColor: t.colour, borderColor: t.colour, color: "#fff" } : { borderColor: t.colour, color: t.colour, background: "transparent" }}
            >
              {t.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Tap the groups this client belongs to, then save.</p>
      <SaveButton />
    </form>
  );
}
