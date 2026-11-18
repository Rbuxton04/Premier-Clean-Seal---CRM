# Making a schema change

Read this before touching `prisma/schema.prisma`. The short version: every
change is additive by default, migrations are written by hand, and nothing
ever runs against the real database except `prisma migrate deploy` during
the Render build.

## The rules

1. **Additive only, unless explicitly approved otherwise.** New models, new
   nullable/defaulted columns, new indexes — fine. Dropping or renaming a
   column, narrowing a type, adding a required column with no default, or
   anything else that could lose or break existing data needs the owner's
   explicit sign-off first.

2. **`prisma/migrations` does not contain the full history.** Most of this
   schema was built up via `prisma db push` before migrations existed here,
   so the migrations folder only covers changes made after that point. This
   means **never run `prisma migrate dev`** — it diffs against the full
   migration history, which doesn't match the real database's actual state,
   and it's allowed to reset the database to reconcile that. Instead, write
   the migration SQL by hand:
   - Create a new folder under `prisma/migrations/` named
     `<YYYYMMDDHHMMSS>_<short_description>` (UTC timestamp, same format as
     the existing folders there).
   - Write `migration.sql` inside it yourself, containing only the SQL for
     your change (`CREATE TABLE`, `ALTER TABLE ... ADD COLUMN`, etc).
   - Update `prisma/schema.prisma` to match.

3. **Never run these against a real database, under any circumstance:**
   - `prisma db push`
   - `prisma migrate reset`
   - `prisma migrate dev`

   All three can drop or rewrite data outside of a reviewed, timestamped
   migration file. The only command allowed to touch the real database's
   schema is `prisma migrate deploy`, and only as part of the Render build
   (see `render.yaml`).

## Testing a change before it ships

Test against a throwaway local database only — never the real one.

1. **Confirm the test database is local before doing anything else.** Check
   that its connection URL points to `localhost` (or `127.0.0.1`). If it
   doesn't, stop.
2. **Build that database on the schema as it was BEFORE your change:**
   - `git show <commit-before-your-change>:prisma/schema.prisma > /tmp/schema.before.prisma`
   - Point `DATABASE_URL` at your local throwaway database.
   - Run `npx prisma db push --schema /tmp/schema.before.prisma` to create
     that starting schema. (`db push` is fine here — this is a disposable
     local database being built from nothing, not the real one the rule
     above is protecting.)
3. **Apply your new migration SQL by hand:**
   - `npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/<your_new_folder>/migration.sql`
4. **Confirm there's no drift between that database and the current schema:**
   - `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
   - This must print nothing (no SQL). Any output means your hand-written
     migration and `schema.prisma` don't actually agree — fix one or the
     other and re-run until the diff is empty.

## Baseline (one-off, Milestone 0B)

`scripts/baseline-migrations.mjs` runs at the start of every build, before
`migrate deploy`. It exists for exactly one historical gap: the
`20260903215150_add_property_room_tracker` migration's tables were created
on production by `prisma db push`, before this project switched to
migration-only deploys (Milestone 0A) -- so production's
`_prisma_migrations` table had no row for it, and `migrate deploy` would
otherwise try to re-run its `CREATE TABLE` statements and fail.

The script checks, in order: is that one migration already recorded as
applied (nothing to do); if not, does the `HotelGroup` table already exist
(proof `db push` created it) -- if so, mark it applied via
`prisma migrate resolve --applied` (bookkeeping only, no schema or data
change) and stop there; if neither, do nothing and let `migrate deploy`
create it normally. It is a no-op once the gap is closed, so it's safe to
leave in the build forever.

**Never add another migration name to this script.** It handles exactly
the one named gap above. Every migration added from now on is applied
normally by `prisma migrate deploy` with no baselining needed, because it
will have been created by a real migration file from the start.

## How it reaches production

Nothing above touches the real database. The only path a schema change
takes to production is: merge to `main` -> Render build runs
`npx prisma migrate deploy` -> it applies whatever new folders exist under
`prisma/migrations/` that it hasn't applied yet, in timestamp order. There
is no `db push` step in the build to fall back on, so a change that only
exists in `schema.prisma` (no migration file) will never reach production.
