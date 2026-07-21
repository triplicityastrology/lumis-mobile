import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const guardrails = readFileSync("supabase/migrations/0020_backend_runtime_guardrails.sql", "utf8");
const operations = readFileSync("supabase/migrations/0021_runtime_observability_and_schedules.sql", "utf8");
const chatIdempotency = readFileSync("supabase/migrations/0022_chat_idempotency_context.sql", "utf8");
const chatEdge = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const profileEdge = readFileSync("supabase/functions/profile/index.ts", "utf8");
const chartWorker = readFileSync("workers/chart-mobile/worker.js", "utf8");
const mobileChat = readFileSync("apps/mobile/src/services/chat.ts", "utf8");
const mobileApp = readFileSync("apps/mobile/App.tsx", "utf8");

for (const [name, source] of [["chat-message", chatEdge], ["profile", profileEdge]]) {
  const diagnostics = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
    reportDiagnostics: true
  }).diagnostics ?? [];
  assert.deepEqual(
    diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
    [],
    `${name} Edge Function contains a TypeScript syntax error`
  );
}

assert.match(guardrails, /billing_period_key text[\s\S]*'calendar:' \|\| to_char\(period_start at time zone 'UTC', 'YYYY-MM'\)/i);
assert.match(guardrails, /monthly_balance_billing_period_key_format/i);
assert.match(guardrails, /default_monthly_balance_period_key_trigger/i);
assert.match(guardrails, /monthly_balance_user_billing_period_idx[\s\S]*\(user_id, billing_period_key\)[\s\S]*grant_type not in/i);
assert.match(guardrails, /max\(allocated\)[\s\S]*min\(remaining\)/i);
assert.doesNotMatch(guardrails, /sum\(allocated\)|sum\(remaining\)/i);
assert.match(guardrails, /chat_messages_user_created_idx[\s\S]*\(user_id, created_at desc\)/i);
assert.match(guardrails, /chat_messages_user_client_msg_idx[\s\S]*role = 'user'/i);
assert.match(guardrails, /pg_advisory_xact_lock[\s\S]*CHAT_IDEMPOTENCY_CONFLICT/i);
assert.match(guardrails, /assistant_message[\s\S]*duplicate/i);
assert.match(chatIdempotency, /p_client_msg_id is null[\s\S]*CHAT_PERSISTENCE_INVALID_INPUT/i);
for (const contextField of [
  "request_force_new_thread",
  "request_thread_id",
  "request_ai_profile_id",
  "request_chart_version",
  "request_persona_style"
]) {
  assert.match(chatIdempotency, new RegExp(contextField), `chat idempotency must retain ${contextField}`);
}
assert.match(
  chatIdempotency,
  /v_existing_route is distinct from[\s\S]*v_existing_force_new_thread is distinct from[\s\S]*v_existing_requested_thread_id is distinct from[\s\S]*v_existing_ai_profile_id is distinct from[\s\S]*v_existing_chart_version is distinct from/i
);
assert.match(guardrails, /create or replace function public\.check_api_rate_limit/i);
assert.match(guardrails, /chart_provider_call_events[\s\S]*review_pending/i);
assert.match(guardrails, /worker_disposition[\s\S]*provider_call_count/i);
assert.match(profileEdge, /workerSummary[\s\S]*providerCallCount/i);
assert.match(operations, /'provider_calls_24h'/i);
assert.match(guardrails, /redact_completed_external_sync_payload[\s\S]*payload_redacted_at/i);
assert.match(guardrails, /payload_expires_at[\s\S]*interval '30 days'/i);
assert.match(guardrails, /redact_expired_external_sync_payloads/i);
assert.match(operations, /perform public\.redact_expired_external_sync_payloads\(\)/i);
assert.match(guardrails, /revoke all on table public\.api_rate_limit_windows from public, anon, authenticated/i);
assert.match(guardrails, /revoke all on table public\.chart_provider_call_events from public, anon, authenticated/i);

assert.match(chatEdge, /p_client_msg_id: normalizeClientMessageId\(body\.client_msg_id\)/);
assert.match(chatEdge, /p_endpoint: "\/chat-message"[\s\S]*p_max_requests: 30[\s\S]*p_window_seconds: 60/);
assert.match(chatEdge, /persisted\?\.duplicate && persisted\.assistantMessage/);
assert.match(mobileChat, /client_msg_id: input\.clientMessageId/);
assert.match(mobileApp, /retryClientMessageId/);
assert.match(mobileApp, /setRetryClientMessageId\(turn\.clientMessageId \?\? randomUUID\(\)\)/);

assert.match(profileEdge, /p_endpoint: "\/profile"[\s\S]*p_max_requests: 5[\s\S]*p_window_seconds: 600/);
assert.match(profileEdge, /recordProviderCallOutcome[\s\S]*persistence_failed/);
assert.match(profileEdge, /recordWorkerPersistenceOutcome[\s\S]*\/mobile\/chart-persistence-outcome/);
assert.match(chartWorker, /CHART_PERSISTENCE_FAILED_AFTER_PROVIDER_CALL/);
assert.match(chartWorker, /persistence_outcome:[\s\S]*persistence_error_code:[\s\S]*persistence_recorded_at:/);
assert.doesNotMatch(profileEdge, /PROFILE_ONBOARDING_FAILED", message: onboardingError\.message/);

assert.match(operations, /create table if not exists public\.runtime_request_events/i);
assert.match(operations, /create or replace function public\.runtime_health_snapshot/i);
assert.match(operations, /create table if not exists public\.runtime_alerts/i);
assert.match(operations, /create or replace function public\.evaluate_runtime_alerts/i);
assert.match(operations, /lumis-runtime-alerts/);
assert.match(operations, /create or replace function public\.purge_runtime_operational_data/i);
assert.match(operations, /lumis-runtime-retention/);
assert.match(operations, /lumis-external-sync-daily-report/);
assert.doesNotMatch(operations, /external-sync-retry[\s\S]*net\.http_post/i);

for (const edgeSource of [
  chatEdge,
  profileEdge,
  readFileSync("supabase/functions/account-deletion-request/index.ts", "utf8"),
  readFileSync("supabase/functions/external-sync-retry/index.ts", "utf8")
]) {
  assert.match(edgeSource, /from "npm:@supabase\/supabase-js@2\.52\.0"/);
  assert.doesNotMatch(edgeSource, /from "@supabase\/supabase-js"/);
}

console.log("backend guardrail contract checks passed");
