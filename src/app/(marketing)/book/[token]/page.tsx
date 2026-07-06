import { notFound } from "next/navigation";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getRebookingCustomer } from "@/services/marketing.service";
import { RebookingForm } from "./rebooking-form";

export const dynamic = "force-dynamic";

export default async function RebookingPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { r?: string };
}) {
  const customer = await getRebookingCustomer(params.token);
  if (!customer) notFound();

  return (
    <div className="container max-w-xl py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Book a free re-check</h1>
      <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      <p className="mt-4 text-sm text-muted-foreground">
        Hi {customer.name.split(" ")[0]}, tell us what needs a look and we&apos;ll be in touch to arrange a visit.
      </p>

      <div className="mt-6">
        <RebookingForm token={params.token} reminderId={searchParams.r} properties={customer.properties} />
      </div>
    </div>
  );
}
