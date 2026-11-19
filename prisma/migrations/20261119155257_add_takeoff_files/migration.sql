-- AlterTable
ALTER TABLE "TakeoffMeasurement" ADD COLUMN     "takeoffFileId" TEXT;

-- CreateTable
CREATE TABLE "TakeoffFile" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "takeoffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "pageCount" INTEGER,
    "pointsPerMetre" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TakeoffFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakeoffFile_takeoffId_deletedAt_idx" ON "TakeoffFile"("takeoffId", "deletedAt");

-- CreateIndex
CREATE INDEX "TakeoffMeasurement_takeoffFileId_idx" ON "TakeoffMeasurement"("takeoffFileId");

-- AddForeignKey
ALTER TABLE "TakeoffMeasurement" ADD CONSTRAINT "TakeoffMeasurement_takeoffFileId_fkey" FOREIGN KEY ("takeoffFileId") REFERENCES "TakeoffFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffFile" ADD CONSTRAINT "TakeoffFile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffFile" ADD CONSTRAINT "TakeoffFile_takeoffId_fkey" FOREIGN KEY ("takeoffId") REFERENCES "Takeoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill (Drawings Part 1 Step 4): one TakeoffFile per existing
-- Takeoff, built from its own pdfFileUrl/pageCount (which stay on Takeoff,
-- additive-only, not dropped), then every existing TakeoffMeasurement
-- pointed at that one file via its TakeoffItem -> Takeoff chain. Runs in
-- the same transaction as the DDL above (prisma migrate deploy wraps each
-- migration.sql in one), so this either fully applies alongside the new
-- table/column or not at all -- never a half-backfilled state.
-- md5(random()...) rather than gen_random_uuid() -- the latter needs either
-- Postgres 13+'s built-in version or the pgcrypto extension enabled; md5()
-- needs neither, and a 32-hex-char string is just as valid a value for a
-- plain `id String @id` column (Prisma's own cuid() default only applies
-- to rows the Prisma Client itself inserts, not this one-off raw SQL
-- backfill).
INSERT INTO "TakeoffFile" ("id", "organisationId", "takeoffId", "name", "fileUrl", "pageCount", "sortOrder", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || t."id"), t."organisationId", t."id", 'Plan', t."pdfFileUrl", t."pageCount", 0, t."createdAt"
FROM "Takeoff" t;

UPDATE "TakeoffMeasurement" m
SET "takeoffFileId" = f."id"
FROM "TakeoffItem" i
JOIN "TakeoffFile" f ON f."takeoffId" = i."takeoffId"
WHERE m."takeoffItemId" = i."id"
  AND m."takeoffFileId" IS NULL;
