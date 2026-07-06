import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { resolveMarketingToken, unsubscribeEmailByToken } from "@/services/marketing.service";
import { UnsubscribeActions } from "./unsubscribe-actions";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: { token: string } }) {
  const customer = await resolveMarketingToken(params.token);

  if (!customer) {
    return (
      <div className="container max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Link not found</h1>
        <BrandSwoosh className="mx-auto mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-4 text-sm text-muted-foreground">
          This unsubscribe link is invalid or has expired. If you&apos;d like to stop receiving messages from us,
          please get in touch and we&apos;ll action it directly.
        </p>
      </div>
    );
  }

  // Arriving on this link is the "one click, no login" action itself —
  // idempotent, so refreshing the page never double-logs the change.
  const result = await unsubscribeEmailByToken(params.token);

  return (
    <div className="container max-w-lg py-16">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {result.alreadyUnsubscribed ? "You're already unsubscribed" : "You've been unsubscribed"}
      </h1>
      <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      <p className="mt-4 text-sm text-muted-foreground">
        Hi {customer.name.split(" ")[0]}, you won&apos;t receive marketing emails or reminders from us any more.
        Changed your mind? You can re-subscribe below.
      </p>

      <div className="mt-6">
        <UnsubscribeActions token={params.token} hasSms={Boolean(customer.phone)} smsSubscribed={customer.marketingSms} />
      </div>
    </div>
  );
}
