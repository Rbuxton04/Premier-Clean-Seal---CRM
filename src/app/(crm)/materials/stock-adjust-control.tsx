"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addStockAction, setStockAction } from "./actions";

/** Compact "+ add stock" / "set stock" control for one catalogue row -- a delivery arriving vs. reconciling after a physical count. Office/Admin only (gated server-side in the actions; this component itself is only rendered for those roles, see page.tsx). */
export function StockAdjustControl({ productId, stockUnit }: { productId: string; stockUnit: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string, qty: number) => Promise<{ ok: boolean; message: string }>) {
    const qty = Number(value);
    if (!value || Number.isNaN(qty)) {
      setError("Enter a quantity.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await action(productId, qty);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={stockUnit}
          className="h-8 w-20 text-xs"
          aria-label={`Adjust stock (${stockUnit})`}
        />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(addStockAction)} title="Add stock (e.g. a delivery arrived)">
          + Add
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(setStockAction)} title="Set stock to this exact value (e.g. after a physical count)">
          Set
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
