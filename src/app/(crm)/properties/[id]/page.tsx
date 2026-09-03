import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, AlertTriangle } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatGBP } from "@/lib/utils";
import { getProperty, getPropertySummary } from "@/services/hotel-property.service";
import { listRoomsForProperty } from "@/services/room.service";
import { listHotelGroupOptions } from "@/services/hotel-group.service";
import { listCustomers } from "@/services/customer.service";
import { PropertyDetailPanel } from "./property-detail-panel";
import { RoomGrid } from "./room-grid";

export const dynamic = "force-dynamic";

export default async function HotelPropertyPage({ params }: { params: { id: string } }) {
  const property = await getProperty(params.id);
  if (!property) notFound();

  const [summary, rooms, groups, customers] = await Promise.all([
    getPropertySummary(params.id),
    listRoomsForProperty(params.id),
    listHotelGroupOptions(),
    listCustomers(),
  ]);

  const priceFullBathGbp = property.priceFullBathGbp != null ? Number(property.priceFullBathGbp) : null;
  const priceShowerOnlyGbp = property.priceShowerOnlyGbp != null ? Number(property.priceShowerOnlyGbp) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={property.hotelGroupId ? `/properties/groups/${property.hotelGroupId}` : "/properties/groups/independent"}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {property.hotelGroup?.name ?? "Independent properties"}
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{property.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[property.town, property.region].filter(Boolean).join(", ")}
          </p>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <Button asChild>
          <Link href={`/properties/${property.id}/rooms/new`}><Plus className="h-4 w-4" /> Add rooms</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Rooms done</p>
          <p className="font-display text-xl font-semibold">{summary.counts.done} / {summary.totalRooms}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Value done</p>
          <p className="font-display text-xl font-semibold">{formatGBP(summary.valueCompletedGbp)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Value remaining</p>
          <p className="font-display text-xl font-semibold">{formatGBP(summary.valueRemainingGbp)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Needs attention</p>
          <p className="font-display text-xl font-semibold flex items-center gap-1.5">
            {summary.needsAttention > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {summary.needsAttention}
          </p>
        </Card>
      </div>

      <PropertyDetailPanel
        property={property}
        trackedBathrooms={rooms.length}
        groups={groups}
        customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
      />

      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rooms yet — <Link href={`/properties/${property.id}/rooms/new`} className="text-primary hover:underline">add rooms</Link> to start tracking this property.
        </p>
      ) : (
        <RoomGrid
          propertyId={property.id}
          rooms={rooms}
          resealIntervalMonths={property.resealIntervalMonths}
          priceFullBathGbp={priceFullBathGbp}
          priceShowerOnlyGbp={priceShowerOnlyGbp}
        />
      )}
    </div>
  );
}
