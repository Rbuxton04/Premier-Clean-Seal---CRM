import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { hasRole, hasAnyRole } from "@/lib/permissions";
import {
  listProducts,
  listProductFilterOptions,
  getLowStockSummary,
  getUsageSummary,
  resolveFinancePeriod,
  type ProductListItem,
  type ProductFilterOptions,
  type LowStockSummary,
  type MaterialsUsageSummary,
  type FinancePeriodPreset,
} from "@/services/materials.service";
import { productAttributeLabels } from "@/validators/product";
import { MaterialsFilters } from "./materials-filters";
import { StockAdjustControl } from "./stock-adjust-control";
import { DeleteProductButton } from "./delete-product-button";
import { LowStockPanel } from "./low-stock-panel";
import { UsageReport } from "./usage-report";

export const dynamic = "force-dynamic";

type MaterialsSearchParams = {
  q?: string; manufacturer?: string; colour?: string; attribute?: string; supplier?: string; lowStockOnly?: string;
  usagePeriod?: string; usageFrom?: string; usageTo?: string;
};

const financePeriodPresets: FinancePeriodPreset[] = ["month", "quarter", "year", "custom"];

async function loadMaterials(searchParams: MaterialsSearchParams) {
  const usagePreset = (financePeriodPresets.find((p) => p === searchParams.usagePeriod) ?? "month") as FinancePeriodPreset;
  const period = resolveFinancePeriod(usagePreset, searchParams.usageFrom, searchParams.usageTo);

  try {
    const [products, filterOptions, lowStock, usage] = await Promise.all([
      listProducts({
        query: searchParams.q,
        manufacturer: searchParams.manufacturer || undefined,
        colour: searchParams.colour || undefined,
        attribute: searchParams.attribute || undefined,
        supplier: searchParams.supplier || undefined,
        lowStockOnly: searchParams.lowStockOnly === "1",
      }),
      listProductFilterOptions(),
      getLowStockSummary(),
      getUsageSummary(period),
    ]);
    return { products, filterOptions, lowStock, usage, dbOnline: true as const };
  } catch {
    return {
      products: [] as ProductListItem[],
      filterOptions: { manufacturers: [], colours: [], suppliers: [] } as ProductFilterOptions,
      lowStock: { count: 0, items: [] } as LowStockSummary,
      usage: { period, totalSpend: 0, byProduct: [] } as MaterialsUsageSummary,
      dbOnline: false as const,
    };
  }
}

export default async function MaterialsPage({ searchParams }: { searchParams: MaterialsSearchParams }) {
  const user = await getCurrentUser();
  const isAdmin = hasRole(user, "ADMIN");
  const canManage = hasAnyRole(user, ["ADMIN", "OFFICE"]);
  const { products, filterOptions, lowStock, usage, dbOnline } = await loadMaterials(searchParams);
  const hasFilters = Boolean(searchParams.q || searchParams.manufacturer || searchParams.colour || searchParams.attribute || searchParams.supplier || searchParams.lowStockOnly);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Materials</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/materials/new"><Plus className="h-4 w-4" /> Add product</Link>
          </Button>
        )}
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma db push &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <LowStockPanel summary={lowStock} />

          <div className="space-y-3">
            <MaterialsFilters options={filterOptions} />
            <p className="text-xs text-muted-foreground">
              Showing {products.length} product{products.length === 1 ? "" : "s"}
              {hasFilters ? " matching your filters" : ""}.
            </p>

            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "No products match your filters." : "No products in the catalogue yet."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Attributes</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    {canManage && <TableHead>Adjust stock</TableHead>}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.manufacturer} {p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.colour}{p.finish ? ` · ${p.finish}` : ""}{p.sku ? ` · ${p.sku}` : ""}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.attributes.map((a) => (
                            <Badge key={a} variant="outline" className="text-[10px]">
                              {productAttributeLabels[a] ?? a}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{p.supplier ?? "—"}</TableCell>
                      <TableCell className="text-right">{p.unitCost != null ? formatGBP(Number(p.unitCost)) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={p.isNegativeStock ? "font-medium text-destructive" : undefined}>
                            {p.stockQuantity} {p.stockUnit}
                          </span>
                          {p.isNegativeStock ? (
                            <Badge variant="danger" className="text-[10px]">Stock negative</Badge>
                          ) : p.isLowStock ? (
                            <Badge variant="warning" className="text-[10px]">Low stock</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <StockAdjustControl productId={p.id} stockUnit={p.stockUnit} />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {canManage && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/materials/${p.id}/edit`}>Edit</Link>
                            </Button>
                          )}
                          {isAdmin && <DeleteProductButton id={p.id} label={`${p.manufacturer} ${p.name} (${p.colour})`} />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <UsageReport summary={usage} />
        </>
      )}
    </div>
  );
}
