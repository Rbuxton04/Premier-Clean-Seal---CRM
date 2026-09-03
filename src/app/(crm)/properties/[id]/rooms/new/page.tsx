import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getProperty } from "@/services/hotel-property.service";
import { RoomGenerator } from "./room-generator";

export const dynamic = "force-dynamic";

export default async function NewRoomsPage({ params }: { params: { id: string } }) {
  const property = await getProperty(params.id);
  if (!property) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href={`/properties/${property.id}`} className="text-xs text-muted-foreground hover:underline">← {property.name}</Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Add rooms</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <RoomGenerator propertyId={property.id} />
    </div>
  );
}
