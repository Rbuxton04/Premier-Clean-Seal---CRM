"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { productAttributes, productAttributeLabels } from "@/validators/product";
import type { ProductInput } from "@/validators/product";
import type { ProductDetail } from "@/services/materials.service";
import { createProductAction, updateProductAction } from "./actions";

function toInputValue(n: number | null): string {
  return n == null ? "" : String(n);
}

export function ProductForm({ product }: { product?: ProductDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [manufacturer, setManufacturer] = useState(product?.manufacturer ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [colour, setColour] = useState(product?.colour ?? "");
  const [finish, setFinish] = useState(product?.finish ?? "");
  const [attributes, setAttributes] = useState<string[]>(product?.attributes ?? []);
  const [supplier, setSupplier] = useState(product?.supplier ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [unitCost, setUnitCost] = useState(toInputValue(product?.unitCost != null ? Number(product.unitCost) : null));
  const [stockQuantity, setStockQuantity] = useState(String(product?.stockQuantity ?? 0));
  const [stockUnit, setStockUnit] = useState(product?.stockUnit ?? "tubes");
  const [lowStockThreshold, setLowStockThreshold] = useState(toInputValue(product?.lowStockThreshold ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  function toggleAttribute(attr: string) {
    setAttributes((cur) => (cur.includes(attr) ? cur.filter((a) => a !== attr) : [...cur, attr]));
  }

  function submit() {
    setMessage(null);
    setErrors({});
    startTransition(async () => {
      const input: ProductInput = {
        manufacturer, name, colour,
        finish: finish || undefined,
        attributes,
        supplier: supplier || undefined,
        sku: sku || undefined,
        unitCost: unitCost ? Number(unitCost) : undefined,
        stockQuantity: Number(stockQuantity || 0),
        stockUnit,
        lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
      };
      const result = product ? await updateProductAction(product.id, input) : await createProductAction(input);
      if (!result.ok) {
        setMessage(result.message);
        setErrors(result.errors ?? {});
        return;
      }
      router.push("/materials");
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="manufacturer">Manufacturer *</Label>
          <Input id="manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Dow" />
          {errors.manufacturer && <p className="text-xs text-destructive">{errors.manufacturer}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Product name *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 785+ Bacteria Resistant" />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="colour">Colour *</Label>
          <Input id="colour" value={colour} onChange={(e) => setColour(e.target.value)} />
          {errors.colour && <p className="text-xs text-destructive">{errors.colour}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finish">Finish</Label>
          <Input id="finish" value={finish} onChange={(e) => setFinish(e.target.value)} placeholder="e.g. Matte" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supplier">Supplier</Label>
          <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU / code</Label>
          <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitCost">Unit cost (£ per tube)</Label>
          <Input id="unitCost" type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Attributes</Label>
          <div className="flex flex-wrap gap-4">
            {productAttributes.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <Checkbox checked={attributes.includes(a)} onChange={() => toggleAttribute(a)} />
                {productAttributeLabels[a]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {product ? "Stock (adjust from the catalogue table instead)" : "Initial stock"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="stockQuantity">Stock quantity</Label>
            <Input id="stockQuantity" type="number" step="0.01" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} disabled={Boolean(product)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stockUnit">Unit</Label>
            <Input id="stockUnit" value={stockUnit} onChange={(e) => setStockUnit(e.target.value)} placeholder="tubes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lowStockThreshold">Low-stock threshold</Label>
            <Input id="lowStockThreshold" type="number" step="0.01" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="e.g. 5" />
          </div>
        </div>
        {product && (
          <p className="text-xs text-muted-foreground">
            Stock quantity is changed via the Add stock / Set stock actions on the catalogue table, not this form, so a routine edit here can never accidentally overwrite someone else&apos;s delivery or count.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending || !manufacturer || !name || !colour} onClick={submit}>
          {pending ? "Saving…" : product ? "Save" : "Add product"}
        </Button>
        {message && <p className="text-sm text-destructive">{message}</p>}
      </div>
    </div>
  );
}
