-- CreateEnum
CREATE TYPE "BathroomType" AS ENUM ('FULL_BATH', 'SHOWER_ONLY', 'BATH_ONLY');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('NOT_STARTED', 'SCHEDULED', 'DONE', 'NO_ACCESS', 'SNAG');

-- CreateEnum
CREATE TYPE "RoomWorkType" AS ENUM ('CUT_OUT_AND_RESEAL', 'NEW_APPLICATION', 'GROUT_STEAM', 'SNAG_RETURN', 'SURVEY');

-- CreateEnum
CREATE TYPE "RoomVisitPhotoKind" AS ENUM ('BEFORE', 'AFTER');

-- CreateTable
CREATE TABLE "HotelGroup" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "HotelGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelProperty" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "hotelGroupId" TEXT,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "town" TEXT,
    "region" TEXT,
    "postcode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "totalBedrooms" INTEGER,
    "siteContactName" TEXT,
    "siteContactRole" TEXT,
    "siteContactPhone" TEXT,
    "siteContactEmail" TEXT,
    "accessNotes" TEXT,
    "sealantBrand" TEXT,
    "sealantColour" TEXT,
    "sealantTubePriceGbp" DECIMAL(10,2),
    "priceFullBathGbp" DECIMAL(10,2),
    "priceShowerOnlyGbp" DECIMAL(10,2),
    "resealIntervalMonths" INTEGER NOT NULL DEFAULT 36,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "HotelProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floor" TEXT,
    "bathroomType" "BathroomType" NOT NULL DEFAULT 'FULL_BATH',
    "status" "RoomStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "lastCompletedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomVisit" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "jobId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "workType" "RoomWorkType" NOT NULL,
    "linearMetres" DECIMAL(8,2),
    "priceGbp" DECIMAL(10,2),
    "sealantBrand" TEXT,
    "sealantColour" TEXT,
    "tubesUsed" DECIMAL(6,2),
    "operative" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomVisitPhoto" (
    "id" TEXT NOT NULL,
    "roomVisitId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "kind" "RoomVisitPhotoKind" NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomVisitPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelGroup_organisationId_name_idx" ON "HotelGroup"("organisationId", "name");

-- CreateIndex
CREATE INDEX "HotelProperty_organisationId_hotelGroupId_idx" ON "HotelProperty"("organisationId", "hotelGroupId");

-- CreateIndex
CREATE INDEX "HotelProperty_organisationId_region_name_idx" ON "HotelProperty"("organisationId", "region", "name");

-- CreateIndex
CREATE INDEX "Room_propertyId_floor_sortIndex_idx" ON "Room"("propertyId", "floor", "sortIndex");

-- CreateIndex
CREATE INDEX "Room_propertyId_status_idx" ON "Room"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_roomNumber_key" ON "Room"("propertyId", "roomNumber");

-- CreateIndex
CREATE INDEX "RoomVisit_roomId_visitDate_idx" ON "RoomVisit"("roomId", "visitDate");

-- AddForeignKey
ALTER TABLE "HotelGroup" ADD CONSTRAINT "HotelGroup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelProperty" ADD CONSTRAINT "HotelProperty_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelProperty" ADD CONSTRAINT "HotelProperty_hotelGroupId_fkey" FOREIGN KEY ("hotelGroupId") REFERENCES "HotelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelProperty" ADD CONSTRAINT "HotelProperty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "HotelProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVisit" ADD CONSTRAINT "RoomVisit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVisit" ADD CONSTRAINT "RoomVisit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVisitPhoto" ADD CONSTRAINT "RoomVisitPhoto_roomVisitId_fkey" FOREIGN KEY ("roomVisitId") REFERENCES "RoomVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

