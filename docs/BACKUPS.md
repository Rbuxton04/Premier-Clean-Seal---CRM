# Database backups & restore drill

## How it works

A Render Cron Job (`premier-crm-backup-cron` in `render.yaml`) POSTs to
`/api/cron/backup` once a day at 03:00 UTC with the `x-cron-secret` header.
That route (`src/app/api/cron/backup/route.ts`) calls `runBackup()`
(`src/services/backup.service.ts`), which:

1. Reads every row of every application table via Prisma (a *logical* export,
   not `pg_dump` — the Render web dyno isn't guaranteed to have Postgres
   client tools installed, but Prisma reads work anywhere the app runs).
2. Serialises the snapshot to one JSON document and gzips it.
3. Uploads it to Supabase Storage as `backups/db-backup-<ISO timestamp>.json.gz`.
4. Prunes anything beyond the most recent 30 backups (roughly a month at a
   daily cadence).
5. Writes an `AuditLog` row (`resource: "backup"`, `action: "RUN"`) so the
   go-live readiness page can show the last-backup timestamp.

If Supabase Storage isn't configured (`NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` missing), the route
no-ops with a warning log and a `{ ok: false }` response — it never crashes
the cron.

## One-time setup

1. Deploy the web service with `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` set.
2. Deploy `premier-crm-backup-cron` from `render.yaml`.
3. On the cron job, set `APP_URL` to the web service's live URL and
   `CRON_SECRET` to the same value configured on the web service.
4. Trigger a manual run from the Render dashboard (or wait for 03:00 UTC) and
   confirm a `backups/db-backup-*.json.gz` object appears in the Supabase
   Storage bucket.

## Restore drill

Practice this periodically — a backup nobody has ever restored is not a
backup you can trust.

1. Download the newest backup object from the Supabase Storage bucket
   (Supabase dashboard, or `downloadObject()` in
   `src/lib/storage/supabase.ts` from a one-off script).
2. Decompress it: `gunzip db-backup-<timestamp>.json.gz`.
3. The result is one JSON document with a top-level key per table
   (`customers`, `quotes`, `jobs`, `invoices`, `mediaFiles`, ...), each an
   array of the rows Prisma would return from `findMany()`.
4. To actually restore into a scratch database: spin up a throwaway Postgres
   (e.g. a local Docker container or a new free Render Postgres), run
   `npx prisma db push` against it to create the schema, then write a small
   script that reads the JSON and calls `db.<model>.createMany({ data: ... })`
   per table, in an order that respects foreign keys (organisations and
   users first, then customers, then everything that references them).
5. Confirm row counts match the original and spot-check a customer record
   end to end (profile, properties, a quote, a job).

## What this doesn't cover

This is tooling, not a compliance guarantee. The operator is responsible for
deciding an actual retention policy, testing restores on a real schedule, and
upgrading off Render's **free** Postgres plan before storing real customer
data — free databases are deleted automatically roughly 30 days after
creation, backups or not. See the go-live readiness page
(`/settings/security`) for a live checklist.
