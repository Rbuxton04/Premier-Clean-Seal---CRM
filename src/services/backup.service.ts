import { gzipSync } from "zlib";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { isR2Configured, uploadBuffer, listObjectKeys, deleteObject } from "@/lib/storage/r2";

const BACKUP_PREFIX = "backups/";
const RETENTION = 30; // keep the last 30 daily backups

/**
 * Logical (not pg_dump) backup: every row in every application table,
 * serialised to one gzipped JSON file. Chosen over shelling out to pg_dump
 * because the Render web dyno isn't guaranteed to have the Postgres client
 * tools installed — Prisma reads work anywhere the app itself already runs.
 */
async function snapshotAllTables() {
  const [
    organisations, users, permissions, customers, tags, properties, workLogs,
    enquiries, aiAnalyses, quotes, quoteLineItems, jobs, materialUsages, products,
    mediaFiles, warranties, invoices, reminders, campaigns, timelineEvents,
    communications, healthScores, insightReports, auditLogs, portalTokens, pendingAiTasks,
  ] = await db.$transaction([
    db.organisation.findMany(),
    db.user.findMany(),
    db.permission.findMany(),
    db.customer.findMany(),
    db.tag.findMany(),
    db.property.findMany(),
    db.propertyWorkLog.findMany(),
    db.enquiry.findMany(),
    db.aIAnalysis.findMany(),
    db.quote.findMany(),
    db.quoteLineItem.findMany(),
    db.job.findMany(),
    db.materialUsage.findMany(),
    db.product.findMany(),
    db.mediaFile.findMany(),
    db.warranty.findMany(),
    db.invoice.findMany(),
    db.marketingReminder.findMany(),
    db.campaign.findMany(),
    db.timelineEvent.findMany(),
    db.communicationLog.findMany(),
    db.jobHealthScore.findMany(),
    db.insightReport.findMany(),
    db.auditLog.findMany(),
    db.portalToken.findMany(),
    db.pendingAITask.findMany(),
  ]);

  return {
    takenAt: new Date().toISOString(),
    organisations, users, permissions, customers, tags, properties, workLogs,
    enquiries, aiAnalyses, quotes, quoteLineItems, jobs, materialUsages, products,
    mediaFiles, warranties, invoices, reminders, campaigns, timelineEvents,
    communications, healthScores, insightReports, auditLogs, portalTokens, pendingAiTasks,
  };
}

export type BackupResult =
  | { ok: true; key: string; sizeBytes: number; pruned: number }
  | { ok: false; message: string };

export async function runBackup(): Promise<BackupResult> {
  if (!isR2Configured()) {
    console.warn("[backup] R2 is not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET) — skipping backup. Set these before storing real customer data.");
    return { ok: false, message: "R2 is not configured — no backup was taken." };
  }

  const snapshot = await snapshotAllTables();
  const json = JSON.stringify(snapshot, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
  const gzipped = gzipSync(Buffer.from(json, "utf8"));

  const key = `${BACKUP_PREFIX}db-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
  await uploadBuffer(key, gzipped, "application/gzip");

  let pruned = 0;
  try {
    const keys = (await listObjectKeys(BACKUP_PREFIX)).sort(); // ISO timestamps in the key sort chronologically
    const stale = keys.slice(0, Math.max(0, keys.length - RETENTION));
    for (const staleKey of stale) {
      await deleteObject(staleKey);
      pruned += 1;
    }
  } catch (err) {
    console.error("[backup] retention sweep failed (backup itself still succeeded)", err);
  }

  await writeAudit({ action: "RUN", resource: "backup", after: { key, sizeBytes: gzipped.byteLength, pruned } });

  return { ok: true, key, sizeBytes: gzipped.byteLength, pruned };
}

/** Timestamp of the most recent successful backup, for the go-live readiness page. */
export async function getLastBackupAt(): Promise<Date | null> {
  const last = await db.auditLog.findFirst({
    where: { organisationId: ORG_ID, resource: "backup", action: "RUN" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}
