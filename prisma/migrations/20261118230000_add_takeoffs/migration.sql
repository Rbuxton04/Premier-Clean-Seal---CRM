-- CreateEnum
CREATE TYPE "TakeoffMeasurementType" AS ENUM ('LENGTH', 'CHAIN');

-- CreateTable
CREATE TABLE "ScalePreset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ratio" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScalePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Takeoff" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pdfFileUrl" TEXT NOT NULL,
    "pageCount" INTEGER,
    "customerId" TEXT,
    "jobId" TEXT,
    "quoteId" TEXT,
    "pointsPerMetre" DOUBLE PRECISION NOT NULL,
    "scaleRatioLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Takeoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakeoffItem" (
    "id" TEXT NOT NULL,
    "takeoffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "pricePerMetre" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TakeoffItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakeoffMeasurement" (
    "id" TEXT NOT NULL,
    "takeoffItemId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "type" "TakeoffMeasurementType" NOT NULL,
    "points" JSONB NOT NULL,
    "computedMetres" DECIMAL(10,2) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TakeoffMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScalePreset_organisationId_idx" ON "ScalePreset"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "ScalePreset_organisationId_label_key" ON "ScalePreset"("organisationId", "label");

-- CreateIndex
CREATE INDEX "Takeoff_organisationId_deletedAt_idx" ON "Takeoff"("organisationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Takeoff_customerId_idx" ON "Takeoff"("customerId");

-- CreateIndex
CREATE INDEX "TakeoffItem_takeoffId_sortOrder_idx" ON "TakeoffItem"("takeoffId", "sortOrder");

-- CreateIndex
CREATE INDEX "TakeoffMeasurement_takeoffItemId_idx" ON "TakeoffMeasurement"("takeoffItemId");

-- AddForeignKey
ALTER TABLE "ScalePreset" ADD CONSTRAINT "ScalePreset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeoff" ADD CONSTRAINT "Takeoff_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeoff" ADD CONSTRAINT "Takeoff_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeoff" ADD CONSTRAINT "Takeoff_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeoff" ADD CONSTRAINT "Takeoff_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffItem" ADD CONSTRAINT "TakeoffItem_takeoffId_fkey" FOREIGN KEY ("takeoffId") REFERENCES "Takeoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffMeasurement" ADD CONSTRAINT "TakeoffMeasurement_takeoffItemId_fkey" FOREIGN KEY ("takeoffItemId") REFERENCES "TakeoffItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

