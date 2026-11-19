-- CreateTable
CREATE TABLE "TakeoffItemPreset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "pricePerMetre" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "TakeoffItemPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakeoffItemPreset_organisationId_deletedAt_idx" ON "TakeoffItemPreset"("organisationId", "deletedAt");

-- AddForeignKey
ALTER TABLE "TakeoffItemPreset" ADD CONSTRAINT "TakeoffItemPreset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

