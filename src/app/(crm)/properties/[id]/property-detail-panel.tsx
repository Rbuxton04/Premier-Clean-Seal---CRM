"use client";

import { useState } from "react";
import { Pencil, Phone, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import { HotelPropertyForm } from "../hotel-property-form";
import type { PropertyDetail } from "@/services/hotel-property.service";

type GroupOption = { id: string; name: string };
type CustomerOption = { id: string; name: string; company: string | null };

export function PropertyDetailPanel({
  property,
  trackedBathrooms,
  groups,
  customers,
}: {
  property: PropertyDetail;
  trackedBathrooms: number;
  groups: GroupOption[];
  customers: CustomerOption[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Edit property</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
        <HotelPropertyForm property={property} groups={groups} customers={customers} onSaved={() => setEditing(false)} />
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Property details</h2>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Site contact</p>
          {property.siteContactName ? (
            <>
              <p className="font-medium">{property.siteContactName}{property.siteContactRole ? ` — ${property.siteContactRole}` : ""}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {property.siteContactPhone && (
                  <a href={`tel:${property.siteContactPhone}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {property.siteContactPhone}
                  </a>
                )}
                {property.siteContactEmail && (
                  <a href={`mailto:${property.siteContactEmail}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" /> {property.siteContactEmail}
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not set</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Sealant</p>
          <p className="font-medium">
            {property.sealantBrand || property.sealantColour ? [property.sealantBrand, property.sealantColour].filter(Boolean).join(" — ") : "Not set"}
          </p>
          {property.sealantTubePriceGbp != null && (
            <p className="text-sm text-muted-foreground">{formatGBP(Number(property.sealantTubePriceGbp))} / tube</p>
          )}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Access notes</p>
          <p className="text-sm">{property.accessNotes || "Not set"}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Bedrooms</p>
          <p className="text-sm">
            {trackedBathrooms} tracked{property.totalBedrooms != null ? ` of ${property.totalBedrooms} total` : ""}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Reseal interval</p>
          <p className="text-sm">Every {property.resealIntervalMonths} months</p>
        </div>

        {property.notes && (
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-sm">{property.notes}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
