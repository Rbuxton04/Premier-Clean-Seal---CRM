"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwoosh } from "./brand-swoosh";
import { visibleNavGroups } from "./nav-items";
import type { Role } from "@prisma/client";

// Mobile-only drawer standing in for the desktop sidebar (which is
// `hidden md:flex`, so it renders nothing below md) — same nav data via
// nav-items.ts, presented as a slide-in panel with its own trigger since
// there's no shared Dialog primitive in this codebase to build on.
export function MobileNav({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const groups = visibleNavGroups(roles);

  // Close on navigation and on Escape; lock body scroll while open so the
  // page behind the drawer doesn't scroll along with it.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-slate-ink text-brand-silver shadow-xl"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="Premier Clean & Seal" width={36} height={36} className="rounded-md" />
                <div>
                  <p className="font-display text-sm font-semibold tracking-[0.18em] text-white">PREMIER</p>
                  <BrandSwoosh className="my-0.5 h-1.5 w-20 text-brand-plum-bright" />
                  <p className="text-[9px] tracking-[0.28em] text-brand-silver/80">CLEAN &amp; SEAL</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-brand-silver hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3" aria-label="Main">
              {groups.map((group, groupIndex) => (
                <div key={group.heading ?? `group-${groupIndex}`} className={groupIndex > 0 ? "pt-4" : undefined}>
                  {group.heading && (
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-[#8A9099]">
                      {group.heading}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const active = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            active ? "bg-brand-plum text-white" : "text-brand-silver/85 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-white/10 p-3">
              <Link
                href="/settings"
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  pathname.startsWith("/settings")
                    ? "bg-brand-plum text-white"
                    : "text-brand-silver/85 hover:bg-white/5 hover:text-white"
                )}
              >
                <Settings className="h-4 w-4" aria-hidden />
                Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
