import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0012_external_sync_delivery_ledger.sql", "utf8");
const deletionMigration = readFileSync("supabase/migrations/0013_account_deletion_external_sync.sql", "utf8");
const deletionFunction = readFileSync("supabase/functions/account-deletion-request/index.ts", "utf8");
const hostedQaLauncher = readFileSync("scripts/run-staging-backend-test.sh", "utf8");
const hostedQaSmoke = readFileSync("scripts/staging-backend-smoke.mjs", "utf8");
const hostedQaCleanup = readFileSync("scripts/staging-backend-cleanup.mjs", "utf8");
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

assert.match(deletionMigration, /create table if not exists public\.account_deletion_requests/i);
assert.match(deletionMigration, /enable row level security/i);
assert.match(deletionMigration, /revoke all on table public\.account_deletion_requests from anon, authenticated/i);
assert.match(deletionMigration, /enqueue_account_deletion_external_sync/i);
assert.match(deletionMigration, /cancelled_due_to_deletion/i);
assert.match(deletionMigration, /array\['salesforce_case', 'google_sheet'\]/i);
assert.match(deletionMigration, /lumis:account-deletion:/i);
assert.match(deletionMigration, /refresh_account_deletion_request_status/i);
assert.match(deletionMigration, /block_external_export_after_deletion_request/i);
assert.match(deletionMigration, /waiting_for_in_flight_exports/i);
assert.match(deletionMigration, /continue_account_deletion_after_export/i);
assert.match(deletionMigration, /DELETION_STALE_CLAIM_CANCELLED/i);
assert.match(deletionMigration, /account-deletion-lease/i);
assert.match(deletionMigration, /salesforce_case_subjects/i);
assert.match(deletionMigration, /internally_deleted/i);
assert.match(deletionMigration, /'operation', 'account_deleted_audit'/i);
assert.match(deletionMigration, /status in \('delivered', 'manually_resolved'\)/i);
assert.doesNotMatch(deletionMigration, /'email'/i, "Deletion payload must not store raw email.");
assert.doesNotMatch(deletionMigration, /email_hash/i, "Deletion workflow must not retain an email hash.");

assert.match(deletionFunction, /DELETE MY LUMIS ACCOUNT/);
assert.match(deletionFunction, /auth\.getUser\(\)/);
assert.match(deletionFunction, /RECENT_AUTH_REQUIRED/);
assert.match(deletionFunction, /last_sign_in_at/);
assert.doesNotMatch(deletionFunction, /sha256|email_hash/i);
assert.match(deletionFunction, /enqueue_account_deletion_external_sync/);
assert.match(hostedQaLauncher, /sb_secret_/);
assert.doesNotMatch(hostedQaLauncher, /temporary legacy|SUPABASE_SERVICE_ROLE_KEY/);
assert.match(hostedQaLauncher, /test:staging-backend:cleanup/);
assert.match(hostedQaSmoke, /Hosted QA run ID/);
assert.match(hostedQaSmoke, /SUPABASE_SECRET_KEY/);
assert.doesNotMatch(hostedQaSmoke, /Authorization.*Bearer.*secretKey/);
assert.match(hostedQaCleanup, /endsWith\(`\.\$\{runId\}@example\.com`\)/);
assert.match(hostedQaCleanup, /auth\/v1\/admin\/users/);

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
assert.match(worker, /appendDeletedAccountMarker/);
assert.match(worker, /GOOGLE_DELETED_ACCOUNTS_SHEET_NAME/);
assert.match(worker, /redactSalesforceCasesForDeletion/);
assert.match(worker, /SALESFORCE_DELETION_LOOKUP_FAILED/);
assert.match(worker, /nextRecordsUrl/);
assert.match(worker, /resolved\.origin !== trustedOrigin/);
assert.match(worker, /SALESFORCE_DELETION_LOOKUP_INVALID_RESPONSE/);
assert.doesNotMatch(
  worker.slice(worker.indexOf("async function discoverSalesforceCasesBySubject")),
  /Subject[\s\S]{0,120}LIMIT 1/i,
  "Deletion lookup must redact every Salesforce Case sharing the deterministic Subject."
);
assert.match(worker, /external_cleanup_requested/);
assert.doesNotMatch(worker, /buildDeletedAccountMarkerRow[\s\S]{0,800}record\.email[,\s]/);

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
