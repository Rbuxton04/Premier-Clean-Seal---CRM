import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Add product</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <ProductForm />
    </div>
  );
}
