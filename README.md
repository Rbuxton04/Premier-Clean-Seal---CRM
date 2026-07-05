# Premier Clean & Seal — CRM

AI-powered CRM and customer-lifecycle platform for Premier Clean & Seal, built to manage
the full journey: **enquiry → AI analysis → quote → job → completion → warranty → automated
yearly marketing → repeat customer**.

**This repository is at Milestone 0** — foundation, branding, database schema, auth, layout
shell, settings, and deployment pipeline. See `docs/` and the project plan for the full
13-milestone roadmap.

## Brand

Colours are taken directly from the company logo:

| Token | Hex | Use |
|---|---|---|
| Slate | `#58606B` | Dark surfaces, sidebar family |
| Slate ink | `#2E333B` | Sidebar background |
| Silver | `#D9D9D9` | Text on dark |
| Plum | `#3C2263` | Primary accent (buttons, active nav, swoosh) |
| Plum bright | `#6A46A8` | Accent on dark mode |

Signature element: the logo's plum **swoosh**, redrawn as an animated SVG
(`src/components/shell/brand-swoosh.tsx`) under page titles and the wordmark.
Display font: Sora (matches the logo's geometric letterforms). Body: Inter.

## Getting started

Requirements: Node 20+, PostgreSQL (local, Docker, or Render).

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum
npx prisma migrate dev      # creates the schema
npm run db:seed             # seeds Premier Clean & Seal org + product catalogue
npm run dev                 # http://localhost:3000
```

**No Clerk keys yet?** The app runs in *open dev mode* (a yellow badge shows in the top bar)
so you can explore immediately. To enable real sign-in: create a free app at clerk.com,
copy the two keys into `.env`, restart.

**No database yet?** The UI still loads — dashboard and settings show a "database not
connected" notice instead of crashing.

Quick local Postgres via Docker:

```bash
docker run --name premier-db -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=premier_crm -p 5432:5432 -d postgres:16
# DATABASE_URL="postgresql://postgres:dev@localhost:5432/premier_crm"
```

## Business settings (Settings page)

- **VAT** — off by default (not yet registered). When you register, tick the box and set the
  rate: every quote/invoice issued *after* that moment includes VAT; documents issued before
  are snapshotted and never change.
- **Default warranty** — months applied to each completed job (per-job override available).
- **Default reminder interval** — months until the automated marketing follow-up.
- **Numbering** — quote `#Q-0000`, invoice `#I-0000` (prefix + zeros = pad width). Counters
  increment atomically in `src/lib/numbering.ts`.

## Cloudflare R2 (photo/video uploads)

The public quote-request form and enquiry pipeline accept photos and videos, uploaded
directly to Cloudflare R2 (never proxied through the Render dyno). Until `R2_*` is set,
the upload UI stays visible but uploads are skipped client-side — enquiries still submit
fine, just without attachments.

To switch it on:

1. Create an R2 bucket in the Cloudflare dashboard (e.g. `premier-crm`), and an API token
   scoped to that bucket (Account → R2 → Manage API Tokens).
2. Add to `.env` (and the Render dashboard): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
3. Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (R2 is S3-compatible) and
   implement `presignUpload()` in `src/lib/storage/r2.ts` — it already has the right shape
   (`{ uploadUrl, publicUrl }`), the public form and `/api/uploads/presign` route call it as
   soon as `isR2Configured()` returns true, no other code needs to change.
4. Turn on public read (or a custom domain) for the bucket so `publicUrl`s are viewable.

## Deploying to Render (free tier)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo — `render.yaml` provisions the web
   service and a free PostgreSQL instance, and runs migrations on deploy.
3. Add environment variables in the Render dashboard (Clerk keys, `CRON_SECRET`, `APP_URL`).
4. Seeding runs automatically on every deploy (it's idempotent — safe to re-run).

Free-tier notes: the service sleeps after ~15 min idle (first request is slow); the free
Postgres database **expires 30 days after creation** (14-day grace period to upgrade before
Render deletes it and all data) — set a reminder and upgrade to the small paid tier (~£5–6/mo)
before day 30 if you're keeping real data in it. All uploads
will live on Cloudflare R2 (Milestone 2), never on the Render disk.

## Backups

Until on a paid Postgres plan with snapshots, run scheduled `pg_dump`s (a cron endpoint that
streams a dump to R2 arrives with the cron infrastructure in Milestone 8). Restore drill:

```bash
pg_dump "$DATABASE_URL" > backup.sql
psql "$NEW_DATABASE_URL" < backup.sql
```

## Project structure

```
prisma/            schema (full domain model) + seed
src/app/(crm)/     authenticated CRM pages
src/app/sign-in/   Clerk sign-in
src/components/    shell (sidebar, topbar, swoosh) + ui primitives
src/lib/           db client, settings/VAT helper, document numbering, utils
render.yaml        one-click Render blueprint
```

## Milestones

0 Foundation ✅ · 1 Customers · 2 Lead capture & Kanban · 3 AI enquiry analysis ·
4 Quotes & e-approval · 5 Jobs & calendar · 6 Completion, materials & warranty ·
7 Galleries & documents · 8 Automated marketing · 9 Dashboard charts & insights ·
10 AI search · 11 Customer portal · 12 Hardening & GDPR

Commit at the end of each milestone: `git tag m0-foundation` etc.
