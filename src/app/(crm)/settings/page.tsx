import { getOrgSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const org = await getOrgSettings();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
          <p className="mt-2 text-sm text-muted-foreground">{org.name}</p>
        </div>
        <a href="/settings/tags" className="block max-w-2xl rounded-lg border p-4 hover:bg-accent/40 transition-colors">
          <p className="font-medium">Client tags →</p>
          <p className="text-sm text-muted-foreground">Create and manage groups like Contractor and Domestic to organise and filter clients.</p>
        </a>
        <SettingsForm
          defaults={{
            vatRegistered: org.vatRegistered,
            vatRatePercent: Number(org.vatRatePercent),
            vatNumber: org.vatNumber ?? "",
            defaultWarrantyMonths: org.defaultWarrantyMonths,
            defaultReminderMonths: org.defaultReminderMonths,
            quoteNumberFormat: org.quoteNumberFormat,
            invoiceNumberFormat: org.invoiceNumberFormat,
          }}
        />
      </div>
    );
  } catch {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      </div>
    );
  }
}
