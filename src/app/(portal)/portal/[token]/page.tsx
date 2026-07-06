import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { resolvePortalToken, getPortalHome, type PortalHome } from "@/services/portal.service";
import { PortalHomeView } from "./portal-home";

export const dynamic = "force-dynamic";

type LoadResult = { state: "invalid" } | { state: "error" } | { state: "ok"; home: PortalHome };

async function loadPortal(token: string): Promise<LoadResult> {
  try {
    const customer = await resolvePortalToken(token);
    if (!customer) return { state: "invalid" };
    const home = await getPortalHome(customer.id);
    return { state: "ok", home };
  } catch {
    return { state: "error" };
  }
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <BrandSwoosh className="mx-auto mt-1 h-2 w-40 text-brand-plum" />
      <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default async function PortalPage({ params }: { params: { token: string } }) {
  const result = await loadPortal(params.token);

  if (result.state === "invalid") {
    return (
      <Message
        title="Link not found"
        body="This portal link is invalid or has expired. Please contact us and we'll send you a fresh one."
      />
    );
  }

  if (result.state === "error") {
    return (
      <Message
        title="We're having trouble right now"
        body="Something went wrong loading your account. Please try again in a few minutes, or contact us directly."
      />
    );
  }

  const { home } = result;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Hi {home.customer.name.split(" ")[0]}</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 text-sm text-muted-foreground">Your Premier Clean &amp; Seal account</p>
      </div>

      <PortalHomeView token={params.token} home={home} />
    </div>
  );
}
