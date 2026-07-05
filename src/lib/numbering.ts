import { db } from "@/lib/db";

/**
 * Document numbering.
 * A format string is a literal prefix followed by a run of zeros that sets
 * the pad width, e.g. "#Q-0000" -> "#Q-0001", "#Q-0002" ... "#Q-10000".
 */
export function formatDocumentNumber(format: string, counter: number): string {
  const match = format.match(/^(.*?)(0+)$/);
  if (!match) return `${format}${counter}`;
  const [, prefix, zeros] = match;
  return `${prefix}${String(counter).padStart(zeros.length, "0")}`;
}

export type DocType = "quote" | "invoice" | "job";

/** Atomically claims the next number for a document type. */
export async function nextDocumentNumber(organisationId: string, doc: DocType): Promise<string> {
  switch (doc) {
    case "quote": {
      const org = await db.organisation.update({
        where: { id: organisationId },
        data: { quoteCounter: { increment: 1 } },
        select: { quoteCounter: true, quoteNumberFormat: true },
      });
      return formatDocumentNumber(org.quoteNumberFormat, org.quoteCounter);
    }
    case "invoice": {
      const org = await db.organisation.update({
        where: { id: organisationId },
        data: { invoiceCounter: { increment: 1 } },
        select: { invoiceCounter: true, invoiceNumberFormat: true },
      });
      return formatDocumentNumber(org.invoiceNumberFormat, org.invoiceCounter);
    }
    case "job": {
      const org = await db.organisation.update({
        where: { id: organisationId },
        data: { jobCounter: { increment: 1 } },
        select: { jobCounter: true, jobNumberFormat: true },
      });
      return formatDocumentNumber(org.jobNumberFormat, org.jobCounter);
    }
  }
}
