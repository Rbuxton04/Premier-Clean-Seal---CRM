import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { HotelGroupForm } from "../../hotel-group-form";

export const dynamic = "force-dynamic";

export default function NewHotelGroupPage() {
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">New hotel group</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <HotelGroupForm />
    </div>
  );
}
