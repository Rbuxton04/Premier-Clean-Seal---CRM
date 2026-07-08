import {
  LayoutDashboard, Inbox, Users, FileText, Wrench, CalendarDays,
  Images, FolderOpen, Layers, Receipt, ShieldCheck, Megaphone, Sparkles, Search, Map, PoundSterling,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@prisma/client";

// roles, when set, restricts an item to those roles only (checked before the
// TECHNICIAN allow-list below) — used for the finance-scoped ACCOUNTANT role
// so it doesn't need its own parallel filtering scheme.
export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[] };
export type NavGroup = { heading: string | null; items: NavItem[] };

// Single source of truth for the nav, shared by the desktop sidebar and the
// mobile drawer so the two never drift out of sync.
export const navGroups: NavGroup[] = [
  { heading: null, items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "SALES",
    items: [
      { href: "/enquiries", label: "Enquiries", icon: Inbox },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/quotes", label: "Quotes", icon: FileText },
    ],
  },
  {
    heading: "OPERATIONS",
    items: [
      { href: "/jobs", label: "Jobs", icon: Wrench },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/map", label: "Map", icon: Map },
    ],
  },
  {
    heading: "RECORDS",
    items: [
      { href: "/gallery", label: "Gallery", icon: Images },
      { href: "/documents", label: "Documents", icon: FolderOpen },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/warranties", label: "Warranties", icon: ShieldCheck },
      { href: "/materials", label: "Materials", icon: Layers },
    ],
  },
  {
    heading: "FINANCE",
    items: [{ href: "/finance", label: "Finance", icon: PoundSterling, roles: ["ADMIN", "OFFICE", "ACCOUNTANT"] }],
  },
  {
    heading: "GROWTH",
    items: [
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/insights", label: "Insights", icon: Sparkles },
      { href: "/search", label: "AI Search", icon: Search },
    ],
  },
];

// TECHNICIAN's day-to-day is assigned jobs + completion — the rest of the
// nav (customers, quotes, invoices, marketing, etc.) is office/admin territory.
// Map is included since "Plan my day" + navigation hand-off is squarely a
// technician, on-the-phone feature.
const TECHNICIAN_ALLOWED_HREFS = new Set(["/jobs", "/calendar", "/map", "/gallery", "/documents"]);

export function visibleNavGroups(role: Role | null): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (role === "TECHNICIAN") return TECHNICIAN_ALLOWED_HREFS.has(item.href);
        if (item.roles) return role != null && item.roles.includes(role);
        // ACCOUNTANT is read-only and finance-scoped -- every item without
        // its own roles allow-list (i.e. everything except Finance above)
        // is hidden for it, same effect as the TECHNICIAN allow-list above
        // but expressed the other way round since ACCOUNTANT's nav is the
        // smaller list.
        return role !== "ACCOUNTANT";
      }),
    }))
    .filter((group) => group.items.length > 0);
}
