-- AlterTable
ALTER TABLE "TakeoffItemPreset" ADD COLUMN "kind" "TakeoffItemKind" NOT NULL DEFAULT 'LENGTH';
ALTER TABLE "TakeoffItemPreset" ADD COLUMN "overrideJointWidthMm" INTEGER;
ALTER TABLE "TakeoffItemPreset" ADD COLUMN "overrideJointDepthMm" INTEGER;
ALTER TABLE "TakeoffItemPreset" ADD COLUMN "overrideWastePercent" DOUBLE PRECISION;
