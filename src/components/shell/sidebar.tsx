"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Users, FileText, Wrench, CalendarDays,
  Layers, Megaphone, Sparkles, Search, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwoosh } from "./brand-swoosh";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/jobs", label: "Jobs", icon: Wrench },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/materials", label: "Materials", icon: Layers },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/search", label: "AI Search", icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-brand-slate-ink text-brand-silver">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Image src="/logo.png" alt="Premier Clean & Seal" width={40} height={40} className="rounded-md" />
        <div>
          <p className="font-display text-sm font-semibold tracking-[0.18em] text-white">PREMIER</p>
          <BrandSwoosh className="my-0.5 h-1.5 w-24 text-brand-plum-bright" />
          <p className="text-[10px] tracking-[0.28em] text-brand-silver/80">CLEAN &amp; SEAL</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 px-3" aria-label="Main">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-plum text-white"
                  : "text-brand-silver/85 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-brand-plum text-white"
              : "text-brand-silver/85 hover:bg-white/5 hover:text-white"
          )}
        >
          <Settings className="h-4 w-4" aria-hidden />
          Settings
        </Link>
      </div>
    </aside>
  );
}
