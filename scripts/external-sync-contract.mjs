import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0012_external_sync_delivery_ledger.sql", "utf8");
const retryFunction = readFileSync("supabase/functions/external-sync-retry/index.ts", "utf8");
const worker = readFileSync("workers/chart-mobile/worker.js", "utf8");
const adminScript = readFileSync("scripts/external-sync-admin.mjs", "utf8");

assert.match(migration, /create table if not exists public\.external_sync_events/i);
assert.match(migration, /unique[\s\S]*idempotency_key|idempotency_key text not null unique/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.external_sync_events from anon, authenticated/i);
assert.match(migration, /for update skip locked/i, "Claims must be concurrency safe.");
assert.match(migration, /attempt_count < 3/i, "Automatic delivery must stop after three attempts.");
assert.match(migration, /interval '1 hour'/i);
assert.match(migration, /interval '3 hours'/i);
assert.match(migration, /failed_final/i);
assert.match(migration, /manual_replay_count/i);
assert.match(migration, /resolved_by text/i);
assert.match(migration, /resolved_at timestamptz/i);
assert.match(migration, /cancelled_due_to_deletion/i);
assert.match(migration, /resolve_external_sync_event/i);
assert.match(migration, /create table if not exists public\.external_sync_daily_reports/i);
assert.match(migration, /create_external_sync_daily_report/i);
assert.match(migration, /enqueue_chart_external_sync_events_trigger/i);
assert.match(migration, /array\['salesforce_case', 'google_sheet'\]/i);

assert.match(retryFunction, /EXTERNAL_SYNC_ENABLED/);
assert.match(retryFunction, /claim_external_sync_events/);
assert.match(retryFunction, /complete_external_sync_event/);
assert.match(retryFunction, /body\.mode === "daily_report"/);
assert.match(retryFunction, /\/mobile\/admin-sync/);
assert.match(retryFunction, /X-Lumis-Signature/);
assert.doesNotMatch(retryFunction, /error instanceof Error \? error\.message/);

assert.match(worker, /url\.pathname === "\/mobile\/admin-sync"/);
assert.match(worker, /GOOGLE_SHEETS_LOOKUP_FAILED/);
assert.match(worker, /SALESFORCE_CASE_LOOKUP_FAILED/);
assert.match(worker, /status: "already_delivered"/);

const natalHandler = worker.slice(
  worker.indexOf("async function handleMobileNatalChart"),
  worker.indexOf("async function handleMobileAdminSync")
);
assert.doesNotMatch(
  natalHandler,
  /appendMobileChartToSheets|createMobileChartSalesforceCase/,
  "Chart generation must not directly dispatch optional external writes."
);

assert.match(adminScript, /command === "report"/);
assert.match(adminScript, /command === "replay"/);
assert.match(adminScript, /command === "resolve"/);
assert.match(adminScript, /replay_external_sync_event/);

console.log("external sync contract checks passed");
