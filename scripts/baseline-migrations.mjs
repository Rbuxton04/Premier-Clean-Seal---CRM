#!/usr/bin/env node
// One-off baseline for a single historical migration -- see
// docs/DATABASE_CHANGES.md ("Baseline (one-off, Milestone 0B)").
//
// Why this exists: 20260903215150_add_property_room_tracker creates the
// HotelGroup/HotelProperty/Room/RoomVisit/RoomVisitPhoto tables, but those
// tables were actually created on production by `prisma db push`, back
// before this project switched to migration-only deploys. That means
// production's `_prisma_migrations` table has no row for this migration,
// even though its tables already exist. Running `prisma migrate deploy`
// as-is would try to CREATE TABLE them again and fail. This script closes
// that one gap -- and only that one -- by marking the migration as applied
// (via `prisma migrate resolve --applied`, pure bookkeeping, no schema or
// data change) if, and only if, it finds proof the tables already exist.
//
// Runs on every deploy. It is a no-op (exits 0, does nothing) once the
// bookkeeping gap is fixed, so it's safe to leave in the build permanently.
//
// IMPORTANT: do not add any other migration name to this script. Every
// migration from now on is applied normally by `prisma migrate deploy` --
// this file handles exactly the one named gap above and nothing else.

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

const MIGRATION_NAME = "20260903215150_add_property_room_tracker";

async function migrationAlreadyRecordedApplied(db) {
  const migrationsTable = await db.$queryRawUnsafe(
    `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS exists`
  );
  if (!migrationsTable[0]?.exists) return false;

  const rows = await db.$queryRawUnsafe(
    `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NOT NULL LIMIT 1`,
    MIGRATION_NAME
  );
  return rows.length > 0;
}

async function hotelGroupTableExists(db) {
  const result = await db.$queryRawUnsafe(`SELECT to_regclass('public."HotelGroup"') IS NOT NULL AS exists`);
  return Boolean(result[0]?.exists);
}

async function main() {
  const db = new PrismaClient();
  try {
    if (await migrationAlreadyRecordedApplied(db)) {
      console.log(`baseline: nothing to do -- ${MIGRATION_NAME} is already recorded as applied.`);
      return;
    }

    if (!(await hotelGroupTableExists(db))) {
      console.log(`baseline: "HotelGroup" table not found -- nothing to baseline, migrate deploy will create it.`);
      return;
    }

    console.log(
      `baseline: "HotelGroup" exists but ${MIGRATION_NAME} isn't recorded as applied -- marking it applied now (bookkeeping only, no schema or data change).`
    );
    execFileSync(
      "npx",
      ["prisma", "migrate", "resolve", "--applied", MIGRATION_NAME, "--schema", "prisma/schema.prisma"],
      { stdio: "inherit" }
    );
    console.log(`baseline: marked ${MIGRATION_NAME} as applied.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("baseline: unexpected error -- stopping the build rather than continuing blindly.");
  console.error(err);
  process.exit(1);
});
