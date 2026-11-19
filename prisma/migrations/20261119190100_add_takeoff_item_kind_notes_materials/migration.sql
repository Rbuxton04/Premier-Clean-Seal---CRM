-- CreateEnum
CREATE TYPE "TakeoffItemKind" AS ENUM ('LENGTH', 'COUNT');

-- AlterTable
ALTER TABLE "TakeoffItem" ADD COLUMN     "kind" "TakeoffItemKind" NOT NULL DEFAULT 'LENGTH',
ADD COLUMN     "overrideJointDepthMm" INTEGER,
ADD COLUMN     "overrideJointWidthMm" INTEGER,
ADD COLUMN     "overrideWastePercent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TakeoffNote" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "takeoffId" TEXT NOT NULL,
    "takeoffFileId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TakeoffNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakeoffMaterialDefaults" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jointWidthMm" INTEGER NOT NULL DEFAULT 15,
    "jointDepthMm" INTEGER NOT NULL DEFAULT 10,
    "tubeMl" INTEGER NOT NULL DEFAULT 310,
    "wastePercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakeoffMaterialDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakeoffNote_takeoffId_deletedAt_idx" ON "TakeoffNote"("takeoffId", "deletedAt");

-- CreateIndex
CREATE INDEX "TakeoffNote_takeoffFileId_idx" ON "TakeoffNote"("takeoffFileId");

-- CreateIndex
CREATE UNIQUE INDEX "TakeoffMaterialDefaults_organisationId_key" ON "TakeoffMaterialDefaults"("organisationId");

-- AddForeignKey
ALTER TABLE "TakeoffNote" ADD CONSTRAINT "TakeoffNote_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffNote" ADD CONSTRAINT "TakeoffNote_takeoffId_fkey" FOREIGN KEY ("takeoffId") REFERENCES "Takeoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffNote" ADD CONSTRAINT "TakeoffNote_takeoffFileId_fkey" FOREIGN KEY ("takeoffFileId") REFERENCES "TakeoffFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffMaterialDefaults" ADD CONSTRAINT "TakeoffMaterialDefaults_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
