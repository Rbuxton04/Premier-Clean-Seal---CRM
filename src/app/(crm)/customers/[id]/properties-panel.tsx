"use client";

import { Badge } from "@/components/ui/badge";
import { PropertyForm } from "../property-form";
import { DeletePropertyButton } from "./delete-property-button";
import { propertyTypeLabels } from "@/validators/customer";
import { WorkLogPanel, type WorkLogEntry, type ProductOption } from "./work-log-panel";

type Property = {
  id: string; addressLine1: string; addressLine2: string | null;
  city: string | null; postcode: string; propertyType: keyof typeof propertyTypeLabels;
  workLogEntries: WorkLogEntry[];
};

export function PropertiesPanel({
  customerId,
  properties,
  products,
  isAdmin,
}: {
  customerId: string;
  properties: Property[];
  products: ProductOption[];
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      {properties.length === 0 ? (
        <p className="text-sm text-muted-foreground">No properties yet. Add one below.</p>
      ) : (
        <ul className="space-y-4">
          {properties.map((p) => (
            <li key={p.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{p.addressLine1}{p.addressLine2 ? `, ${p.addressLine2}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{[p.city, p.postcode].filter(Boolean).join(", ")}</p>
                  <Badge variant="secondary" className="mt-1">{propertyTypeLabels[p.propertyType]}</Badge>
                </div>
                {isAdmin && (
                  <DeletePropertyButton
                    customerId={customerId}
                    propertyId={p.id}
                    address={`${p.addressLine1}, ${p.postcode}`}
                  />
                )}
              </div>
              <WorkLogPanel customerId={customerId} propertyId={p.id} entries={p.workLogEntries} products={products} />
            </li>
          ))}
        </ul>
      )}
      <PropertyForm customerId={customerId} />
    </div>
  );
}
