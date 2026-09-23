import { notFound } from "next/navigation";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getProduct } from "@/services/materials.service";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  if (!product) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Edit product</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <ProductForm product={product} />
    </div>
  );
}
