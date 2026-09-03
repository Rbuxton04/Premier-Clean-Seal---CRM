// Client-safe mirror of roomPriceGbp() in src/services/room.service.ts.
// That module also imports @/lib/db (Prisma Client), which can't be bundled
// into a "use client" component, so this tiny pure formula is duplicated
// here rather than imported -- keep the two in sync if the pricing rule
// changes (BATH_ONLY priced the same as a full bath -- see the comment on
// roomPriceGbp for why).
import type { BathroomType } from "@prisma/client";

export const DEFAULT_PRICE_FULL_BATH_GBP = 250;
export const DEFAULT_PRICE_SHOWER_ONLY_GBP = 120;

export function roomPriceGbp(bathroomType: BathroomType, priceFullBathGbp: number | null, priceShowerOnlyGbp: number | null): number {
  if (bathroomType === "SHOWER_ONLY") {
    return priceShowerOnlyGbp ?? DEFAULT_PRICE_SHOWER_ONLY_GBP;
  }
  return priceFullBathGbp ?? DEFAULT_PRICE_FULL_BATH_GBP;
}

/** Client-safe mirror of isResealDue() in room.service.ts. */
export function isResealDue(lastCompletedAt: Date | null, resealIntervalMonths: number, now: Date = new Date()): boolean {
  if (!lastCompletedAt) return false;
  const due = new Date(lastCompletedAt);
  due.setMonth(due.getMonth() + resealIntervalMonths);
  return due <= now;
}

/** "Mar '25" -- the room tile's compact last-completed label. */
export function formatShortDate(date: Date): string {
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${month} '${year}`;
}

/** Whole months between a past date and now, for "resealed N months ago" in the room sheet. */
export function monthsAgo(date: Date, now: Date = new Date()): number {
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth()));
}
