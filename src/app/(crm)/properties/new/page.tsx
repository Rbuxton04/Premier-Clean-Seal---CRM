import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { listHotelGroupOptions } from "@/services/hotel-group.service";
import { listCustomers } from "@/services/customer.service";
import { HotelPropertyForm } from "../hotel-property-form";

export const dynamic = "force-dynamic";

export default async function NewHotelPropertyPage({ searchParams }: { searchParams: { groupId?: string } }) {
  const [groups, customers] = await Promise.all([listHotelGroupOptions(), listCustomers()]);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">New property</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <HotelPropertyForm
        groups={groups}
        customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
        defaultGroupId={searchParams.groupId}
      />
    </div>
  );
}
