import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Building2 } from "lucide-react";
import { getCustomer } from "@/services/customer.service";
import { listTags } from "@/services/tag.service";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { CustomerForm } from "../customer-form";
import { Tabs } from "./tabs";
import { Timeline } from "./timeline";
import { PropertiesPanel } from "./properties-panel";
import { TagsPanel } from "./tags-panel";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: { id: string } }) {
  const customer = await getCustomer(params.id);
  if (!customer) notFound();
  const allTags = await listTags().catch(() => []);

  const stat = (label: string, value: string) => (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{customer.name}</h1>
          {customer.company && <Badge variant="secondary"><Building2 className="mr-1 h-3 w-3" />{customer.company}</Badge>}
          {customer.tags.map((t) => (
            <span key={t.id} className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: t.colour }}>{t.name}</span>
          ))}
          {customer.marketingEmail && <Badge variant="secondary">Email opt-in</Badge>}
          {customer.marketingSms && <Badge variant="secondary">SMS opt-in</Badge>}
        </div>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {customer.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
          {customer.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {stat("Lifetime spend", formatGBP(Number(customer.totalSpend)))}
        {stat("Properties", String(customer.properties.length))}
        {stat("Jobs", String(customer._count.jobs))}
        {stat("Quotes", String(customer._count.quotes))}
      </div>

      <Card>
        <CardContent className="pt-5">
          <Tabs
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: customer.notes
                  ? <p className="whitespace-pre-wrap text-sm">{customer.notes}</p>
                  : <p className="text-sm text-muted-foreground">No notes yet. Use Edit to add some.</p>,
              },
              {
                id: "properties",
                label: `Properties (${customer.properties.length})`,
                content: <PropertiesPanel customerId={customer.id} properties={customer.properties as any} />,
              },
              {
                id: "tags",
                label: `Tags (${customer.tags.length})`,
                content: <TagsPanel customerId={customer.id} allTags={allTags.map((t) => ({ id: t.id, name: t.name, colour: t.colour }))} assigned={customer.tags.map((t) => t.id)} />,
              },
              { id: "timeline", label: "Timeline", content: <Timeline events={customer.timeline as any} /> },
              {
                id: "edit",
                label: "Edit",
                content: (
                  <div className="max-w-2xl">
                    <CustomerForm
                      mode="edit"
                      id={customer.id}
                      defaults={{
                        name: customer.name,
                        company: customer.company ?? undefined,
                        phone: customer.phone ?? undefined,
                        email: customer.email ?? undefined,
                        notes: customer.notes ?? undefined,
                        marketingEmail: customer.marketingEmail,
                        marketingSms: customer.marketingSms,
                      }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
