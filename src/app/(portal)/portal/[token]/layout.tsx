import Image from "next/image";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-brand-slate-ink">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Image src="/logo.png" alt="Premier Clean & Seal" width={40} height={40} className="rounded-md" />
          <div>
            <p className="font-display text-sm font-semibold tracking-[0.18em] text-white">PREMIER</p>
            <BrandSwoosh className="my-0.5 h-1.5 w-24 text-brand-plum-bright" />
            <p className="text-[10px] tracking-[0.28em] text-brand-silver/80">CLEAN &amp; SEAL</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      <footer className="py-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Premier Clean &amp; Seal — Wigan, England</footer>
    </div>
  );
}
