import { financePeriodQuerySchema } from "@/validators/finance";
import { resolveFinancePeriod, type FinancePeriod } from "@/services/finance.service";

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Shared by every /finance/* page so the period query param is parsed and defaulted identically everywhere. */
export function parsePeriod(searchParams: Record<string, string | string[] | undefined>): FinancePeriod {
  const parsed = financePeriodQuerySchema.safeParse({
    period: firstParam(searchParams.period),
    from: firstParam(searchParams.from),
    to: firstParam(searchParams.to),
  });
  const { period, from, to } = parsed.success ? parsed.data : { period: "month" as const, from: undefined, to: undefined };
  return resolveFinancePeriod(period, from, to);
}
