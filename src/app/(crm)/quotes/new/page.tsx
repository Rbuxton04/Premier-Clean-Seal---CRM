import Link from "next/link";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { listCustomers } from "@/services/customer.service";
import { listProductOptions } from "@/services/property.service";
import { buildDraftFromEnquiry } from "@/services/quote.service";
import { getOrgSettings } from "@/lib/settings";
import { QuoteBuilder } from "../quote-builder";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: { enquiryId?: string } }) {
  const [customers, products, org] = await Promise.all([
    listCustomers(),
    listProductOptions(),
    getOrgSettings(),
  ]);

  let initial = {
    customerId: "",
    enquiryId: undefined as string | undefined,
    scopeOfWorks: "",
    terms: "",
    warrantyMonths: org.defaultWarrantyMonths,
    lineItems: [{ description: "", quantity: 1, unit: "each", unitPrice: 0 }],
  };

  if (searchParams.enquiryId) {
    const draft = await buildDraftFromEnquiry(searchParams.enquiryId);
    if (!draft) {
      return (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">New quote</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
          <p className="text-sm text-muted-foreground">
            This enquiry needs to be converted to a customer before a quote can be created.{" "}
            <Link href={`/enquiries/${searchParams.enquiryId}`} className="text-primary underline">Back to enquiry</Link>
          </p>
        </div>
      );
    }
    initial = draft;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">New quote</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <QuoteBuilder
        mode="create"
        customers={customers}
        products={products}
        org={{ vatRegistered: org.vatRegistered, vatRatePercent: Number(org.vatRatePercent), defaultWarrantyMonths: org.defaultWarrantyMonths }}
        initial={initial}
      />
    </div>
  );
}
