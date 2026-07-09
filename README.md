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

## Supabase Storage (photo/video uploads)

The public quote-request form and enquiry pipeline accept photos and videos, uploaded
directly to Supabase Storage (never proxied through the Render dyno). Until
`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` are
set, the upload UI stays visible but uploads are skipped client-side — enquiries still
submit fine, just without attachments.

To switch it on:

1. In the Supabase dashboard: Project Settings → API for the project URL and secret key;
   Storage → create a bucket (private recommended — see `src/lib/storage/supabase.ts`).
2. Add to `.env` (and the Render dashboard): `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
3. That's it — `presignUpload()` in `src/lib/storage/supabase.ts` already has the right
   shape (`{ uploadUrl, path }`), and the public form and `/api/uploads/presign` route call
   it as soon as `isSupabaseStorageConfigured()` returns true, no other code needs to change.
4. The bucket stays private — `getFileUrl()` mints short-lived signed URLs server-side for
   viewing, so nothing needs to be made publicly readable.

## Quotes & e-approval

Quotes are built in-app (`/quotes`), rendered as a branded PDF (`@react-pdf/renderer`,
`src/lib/pdf/quote-pdf.tsx`), and sent to the customer with a tokened approval link at
`/quote/[token]` — no login required, the token is the credential. Approving records a typed
name + IP as the electronic acceptance; this is a reasonable acceptance for a trade quote, not
a formal qualified e-signature service.

- **PDF generation always works**, Supabase Storage configured or not — the download routes
  render on demand. If storage is configured, `sendQuote()` also persists a copy to
  `quotes/<number>.pdf` via `uploadFile()` in `src/lib/storage/supabase.ts` and stores the
  path on `Quote.pdfUrl` as a cache.
- **Emailing needs `RESEND_API_KEY`.** Until it's set, "Send" still generates the approval
  token/link and marks the quote `SENT` — staff copy the link from the in-app banner instead of
  it being emailed. Add the key and `sendQuote()` starts emailing automatically, no other code
  changes.
- **Deposit payment is a stub.** The approval page shows the deposit amount with a disabled
  "Pay deposit" button — real card payment needs Stripe (or another PSP), a later milestone.

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
will live on Supabase Storage, never on the Render disk.

## Backups

Until on a paid Postgres plan with snapshots, run scheduled `pg_dump`s (a cron endpoint that
streams a dump to Supabase Storage arrives with the cron infrastructure in Milestone 8).
Restore drill:

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
src/lib/pdf/       branded PDF generators (@react-pdf/renderer)
src/lib/email/     Resend email seam
render.yaml        one-click Render blueprint
```

## Milestones

0 Foundation ✅ · 1 Customers · 2 Lead capture & Kanban · 3 AI enquiry analysis ·
4 Quotes & e-approval ✅ · 5 Jobs & calendar · 6 Completion, materials & warranty ·
7 Galleries & documents · 8 Automated marketing · 9 Dashboard charts & insights ·
10 AI search · 11 Customer portal · 12 Hardening & GDPR

Commit at the end of each milestone: `git tag m0-foundation` etc.
