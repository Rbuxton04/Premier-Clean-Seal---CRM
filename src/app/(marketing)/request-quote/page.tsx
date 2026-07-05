import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { isR2Configured } from "@/lib/storage/r2";
import { RequestQuoteForm } from "./request-quote-form";

export const metadata = { title: "Request a Quote — Premier Clean & Seal" };
export const dynamic = "force-dynamic";

export default function RequestQuotePage() {
  const photosEnabled = isR2Configured();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-plum">Request a free quote</h1>
      <BrandSwoosh className="mt-2 h-2 w-48 text-brand-plum" />
      <p className="mt-4 text-sm text-muted-foreground">
        Tell us about the job and we&apos;ll get back to you — usually within one working day.
        Premier Clean &amp; Seal covers Wigan and the surrounding area.
      </p>

      <div className="mt-8">
        <RequestQuoteForm photosEnabled={photosEnabled} />
      </div>
    </div>
  );
}
