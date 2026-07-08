import Link from "next/link";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinance } from "@/lib/permissions";

const tabs = [
  { href: "/finance", label: "Overview" },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/outstanding", label: "Outstanding" },
  { href: "/finance/quotes-jobs", label: "Quotes & jobs" },
  { href: "/finance/materials", label: "Materials" },
  { href: "/finance/vat", label: "VAT" },
];

async function loadAccess(): Promise<{ allowed: boolean; dbOnline: boolean }> {
  try {
    const user = await getCurrentUser();
    const allowed = await canViewFinance(user?.role ?? null);
    return { allowed, dbOnline: true };
  } catch {
    return { allowed: false, dbOnline: false };
  }
}

// Shared guard + sub-nav for every /finance/* page. Read access is
// server-checked here (not just a hidden sidebar link) via canViewFinance,
// which defaults to ADMIN/OFFICE/ACCOUNTANT — see src/lib/permissions.ts.
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { allowed, dbOnline } = await loadAccess();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Finance</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && !allowed && <Badge variant="warning">Finance is restricted to Admin, Office, and Accountant roles.</Badge>}

      {dbOnline && allowed && (
        <>
          <nav className="flex flex-wrap gap-1 border-b pb-2 text-sm" aria-label="Finance sections">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {children}
        </>
      )}
    </div>
  );
}
