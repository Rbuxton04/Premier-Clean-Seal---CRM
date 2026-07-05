import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">New customer</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <Card><CardContent className="pt-5"><CustomerForm mode="create" /></CardContent></Card>
    </div>
  );
}
