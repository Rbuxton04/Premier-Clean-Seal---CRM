import { BrandSwoosh } from "@/components/shell/brand-swoosh";

export default function Page() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Marketing</h1>
      <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      <p className="mt-4 text-sm text-muted-foreground">
        Coming in an upcoming milestone — the schema and navigation are already in place.
      </p>
    </div>
  );
}
