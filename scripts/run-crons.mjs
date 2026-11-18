#!/usr/bin/env node
// Runs the three cron-triggered endpoints from one paid cron job instead of
// three free ones -- Render has no free plan for cron services. See
// docs/DATABASE_CHANGES.md and render.yaml's premier-crm-daily-cron.
// No dependencies -- uses Node 20's built-in fetch only.
//
// Order: backup, then marketing, every day; insights only on Mondays (UTC),
// matching its old weekly-only schedule. Each call is independent -- one
// failing must not skip the others -- and gets one retry after a short
// wait, since the free web service sleeps when idle and the first request
// of the day can be slow to wake it.

const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!APP_URL || !CRON_SECRET) {
  console.error("run-crons: APP_URL and CRON_SECRET must both be set -- stopping.");
  process.exit(1);
}

const TIMEOUT_MS = 120_000;
const RETRY_DELAY_MS = 5_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOnce(path) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function callWithRetry(path) {
  try {
    return await callOnce(path);
  } catch (err) {
    console.log(`${path}: first attempt failed (${err.message}) -- retrying once...`);
    await sleep(RETRY_DELAY_MS);
    try {
      return await callOnce(path);
    } catch (err2) {
      return { ok: false, status: null, body: String(err2.message ?? err2) };
    }
  }
}

async function run(path) {
  const result = await callWithRetry(path);
  console.log(`${path}: ${result.ok ? "OK" : "FAILED"} (status ${result.status}) -- ${result.body}`);
  return result.ok;
}

async function main() {
  const results = [];
  results.push(await run("/api/cron/backup"));
  results.push(await run("/api/cron/marketing"));

  const isMonday = new Date().getUTCDay() === 1;
  if (isMonday) {
    results.push(await run("/api/cron/insights"));
  } else {
    console.log("/api/cron/insights: skipped (only runs on Mondays UTC)");
  }

  const anyFailed = results.some((ok) => !ok);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("run-crons: unexpected error");
  console.error(err);
  process.exit(1);
});
