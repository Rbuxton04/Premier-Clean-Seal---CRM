# Database backups & restore drill

## How it works

A Render Cron Job (`premier-crm-daily-cron` in `render.yaml`) fires once a
day at 08:00 UTC and runs `scripts/run-crons.mjs`, which POSTs to
`/api/cron/backup` (first, before marketing and -- on Mondays -- insights)
with the `x-cron-secret` header. That route
(`src/app/api/cron/backup/route.ts`) calls `runBackup()`
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
2. Deploy `premier-crm-daily-cron` from `render.yaml`.
3. On the cron job, set `APP_URL` to the web service's live URL and
   `CRON_SECRET` to the same value configured on the web service.
4. Trigger a manual run from the Render dashboard (or wait for 08:00 UTC) and
   confirm a `backups/db-backup-*.json.gz` object appears in the Supabase
   Storage bucket. The same run also calls the marketing-reminder endpoint,
   and the insights endpoint on Mondays -- see `scripts/run-crons.mjs`.

## Restore drill

Practice this periodically — a backup nobody has ever restored is not a
backup you can trust.

1. Download the newest backup object from the Supabase Storage bucket
   (Supabase dashboard, or `downloadObject()` in
   `src/lib/storage/supabase.ts` from a one-off script).
2. Decompress it: `gunzip db-backup-<timestamp>.json.gz`.
3. The result is one JSON document with a top-level key per table
   (`customers`, `quotes`, `jobs`, `invoices`, `mediaFiles`, `hotelGroups`,
   `hotelProperties`, `rooms`, `roomVisits`, `roomVisitPhotos`,
   `certifications`, ...), each an array of the rows Prisma would return
   from `findMany()` — plus one special key, `customerTags` (see below).
4. To actually restore into a scratch database: spin up a throwaway Postgres
   (e.g. a local Docker container or a new free Render Postgres) — confirm
   its URL points to localhost/a disposable instance, never a real
   database — run `npx prisma db push` against it to create the schema
   (fine here: this is a throwaway target, not the real database that
   `docs/DATABASE_CHANGES.md` bans `db push` against), then write a small
   script that reads the JSON and calls `db.<model>.createMany({ data: ... })`
   per table, in an order that respects foreign keys (organisations and
   users first, then customers, then everything that references them).
5. Restore customer tags last, once both customers and tags exist.
   `customerTags` isn't a table — it's the implicit Customer<->Tag join
   (`@relation("CustomerTags")` in `schema.prisma`), captured in the backup
   as `{ customerId, tagIds }` pairs since Prisma has no `findMany()` for an
   implicit join table directly. Restore it by looping the array and calling
   `db.customer.update({ where: { id: customerId }, data: { tags: { connect: tagIds.map((id) => ({ id })) } } })`
   for each entry.
6. `WeatherCache` is deliberately not in the backup (see the comment in
   `snapshotAllTables()`) — it's just a geocoded-forecast cache, not
   business data, and repopulates itself as the map/calendar views run.
7. Confirm row counts match the original and spot-check a customer record
   end to end (profile, properties, a quote, a job, its tags).

## What this doesn't cover

This is tooling, not a compliance guarantee. The operator is responsible for
deciding an actual retention policy, testing restores on a real schedule, and
upgrading off Render's **free** Postgres plan before storing real customer
data — free databases are deleted automatically roughly 30 days after
creation, backups or not. See the go-live readiness page
(`/settings/security`) for a live checklist.
