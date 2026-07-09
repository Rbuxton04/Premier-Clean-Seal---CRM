import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { clerkEnabled } from "@/lib/auth";
import { isSupabaseStorageConfigured } from "@/lib/storage/supabase";
import { isResendConfigured } from "@/lib/email/resend";
import { getLastBackupAt } from "@/services/backup.service";

export type ReadinessStatus = "green" | "amber" | "red";
export type ReadinessItem = { id: string; label: string; status: ReadinessStatus; detail: string; howToFix?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeReadiness(): Promise<ReadinessItem[]> {
  const [adminCount, auditLogCount, lastBackupAt] = await Promise.all([
    db.user.count({ where: { organisationId: ORG_ID, roles: { has: "ADMIN" }, active: true } }),
    db.auditLog.count({ where: { organisationId: ORG_ID } }),
    getLastBackupAt(),
  ]);

  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  const cronSecretSet = Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET !== "change-me");

  const items: ReadinessItem[] = [];

  items.push(
    clerkEnabled
      ? { id: "signin", label: "Staff sign-in", status: "green", detail: "Clerk keys are set — real sign-in is enforced on all CRM routes." }
      : {
          id: "signin",
          label: "Staff sign-in",
          status: "red",
          detail: "Clerk keys are absent — the app is running in open dev mode with no real authentication.",
          howToFix: "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY before going live.",
        }
  );

  items.push(
    adminCount > 0
      ? { id: "roles", label: "Roles configured", status: "green", detail: `${adminCount} active admin${adminCount === 1 ? "" : "s"} on the team.` }
      : {
          id: "roles",
          label: "Roles configured",
          status: clerkEnabled ? "red" : "amber",
          detail: "No active ADMIN user exists yet.",
          howToFix: "Sign in once with Clerk, then promote your account to ADMIN in Settings -> Staff & roles (or via the seed).",
        }
  );

  items.push(
    auditLogCount > 0
      ? { id: "audit", label: "Audit log", status: "green", detail: `${auditLogCount} events recorded.` }
      : { id: "audit", label: "Audit log", status: "amber", detail: "No audit events recorded yet — this fills in as staff use the app." }
  );

  items.push({
    id: "rate-limit",
    label: "Rate limiting",
    status: "green",
    detail: "Public forms (enquiry, portal message/request, quote approval) are rate-limited per IP.",
  });

  if (!isSupabaseStorageConfigured()) {
    items.push({
      id: "backups",
      label: "Daily backups",
      status: "amber",
      detail: "Storage isn't configured, so the backup cron no-ops.",
      howToFix: "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, then add the Render Cron Job from render.yaml.",
    });
  } else if (!lastBackupAt) {
    items.push({
      id: "backups",
      label: "Daily backups",
      status: "amber",
      detail: "Storage is configured but no backup has run yet.",
      howToFix: "Confirm the Render Cron Job (premier-crm-backup-cron) is deployed and has APP_URL + CRON_SECRET set.",
    });
  } else {
    const ageHours = (Date.now() - lastBackupAt.getTime()) / (60 * 60 * 1000);
    items.push({
      id: "backups",
      label: "Daily backups",
      status: ageHours < 36 ? "green" : "amber",
      detail: `Last backup: ${lastBackupAt.toLocaleString("en-GB")}.`,
      howToFix: ageHours < 36 ? undefined : "The last backup is over 36 hours old — check the Render Cron Job's run history.",
    });
  }

  items.push(
    isSupabaseStorageConfigured()
      ? { id: "storage", label: "File storage (Supabase)", status: "green", detail: "Supabase Storage is configured — uploads, PDFs and backups persist." }
      : { id: "storage", label: "File storage (Supabase)", status: "amber", detail: "Storage isn't configured — uploaded files and generated PDFs aren't persisted.", howToFix: "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET." }
  );

  items.push(
    isResendConfigured()
      ? { id: "resend", label: "Email (Resend)", status: "green", detail: "Quotes, reminders, and portal links are emailed automatically." }
      : { id: "resend", label: "Email (Resend)", status: "amber", detail: "RESEND_API_KEY isn't set — emails fall back to in-app links for staff to share manually.", howToFix: "Set RESEND_API_KEY." }
  );

  items.push(
    twilioConfigured
      ? { id: "twilio", label: "SMS (Twilio)", status: "green", detail: "SMS reminders are enabled." }
      : { id: "twilio", label: "SMS (Twilio)", status: "amber", detail: "Twilio isn't configured — SMS channels are skipped.", howToFix: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM." }
  );

  items.push(
    cronSecretSet
      ? { id: "cron-secret", label: "Cron secret", status: "green", detail: "CRON_SECRET has been changed from the default." }
      : { id: "cron-secret", label: "Cron secret", status: "red", detail: "CRON_SECRET is unset or still the placeholder value — cron endpoints aren't properly protected.", howToFix: "Set a strong random CRON_SECRET on both the web service and the cron jobs." }
  );

  items.push({
    id: "db-tier",
    label: "Database plan",
    status: "amber",
    detail: "Render's free Postgres is deleted automatically after ~30 days of the database's creation.",
    howToFix: "Upgrade the Render Postgres instance to a paid plan before storing real customer data long-term.",
  });

  return items;
}
