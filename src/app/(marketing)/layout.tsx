import Image from "next/image";
import Link from "next/link";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-brand-slate-ink">
        <div className="container flex items-center gap-3 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Premier Clean & Seal" width={36} height={36} className="rounded-md" />
            <div>
              <p className="font-display text-sm font-semibold tracking-[0.18em] text-white">PREMIER</p>
              <BrandSwoosh className="my-0.5 h-1.5 w-20 text-brand-plum-bright" />
              <p className="text-[9px] tracking-[0.28em] text-brand-silver/80">CLEAN &amp; SEAL</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Premier Clean &amp; Seal — Wigan, England
      </footer>
    </div>
  );
}
