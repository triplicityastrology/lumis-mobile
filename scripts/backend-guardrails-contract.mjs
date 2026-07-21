import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const guardrails = readFileSync("supabase/migrations/0020_backend_runtime_guardrails.sql", "utf8");
const operations = readFileSync("supabase/migrations/0021_runtime_observability_and_schedules.sql", "utf8");
const chatIdempotency = readFileSync("supabase/migrations/0022_chat_idempotency_context.sql", "utf8");
const strictRetention = readFileSync("supabase/migrations/0023_strict_sync_retention_and_provider_attempts.sql", "utf8");
const providerConcurrency = readFileSync("supabase/migrations/0024_provider_attempt_concurrency_and_payload_allowlist.sql", "utf8");
const schedulerStatus = readFileSync("supabase/migrations/0025_runtime_scheduler_status.sql", "utf8");
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

assert.match(profileEdge, /profileRateLimit = await consumeProfileRateLimit\(serviceClient, userId\)/);
assert.match(profileEdge, /endpoint = "\/profile"[\s\S]*maxRequests = 5[\s\S]*windowSeconds = 600/);
assert.match(profileEdge, /p_endpoint: endpoint[\s\S]*p_max_requests: maxRequests[\s\S]*p_window_seconds: windowSeconds/);
assert.match(profileEdge, /consumeProfileRateLimit\(serviceClient, userId, endpoint, 3, 600\)/);
assert.match(profileEdge, /recordProviderCallOutcome[\s\S]*persistence_failed/);
assert.match(profileEdge, /rpc\("record_chart_provider_call_event"/);
assert.match(profileEdge, /recordWorkerPersistenceOutcome[\s\S]*\/mobile\/chart-persistence-outcome/);
assert.match(chartWorker, /CHART_PERSISTENCE_FAILED_AFTER_PROVIDER_CALL/);
assert.match(chartWorker, /persistence_outcome:[\s\S]*persistence_error_code:[\s\S]*persistence_recorded_at:/);
assert.doesNotMatch(profileEdge, /PROFILE_ONBOARDING_FAILED", message: onboardingError\.message/);

assert.match(strictRetention, /chart_provider_call_attempt_events[\s\S]*unique \(request_id, attempt_number\)/i);
assert.match(strictRetention, /generate_series\(v_previous_count \+ 1, v_effective_count\)/i);
assert.match(
  strictRetention,
  /'provider_calls_24h'[\s\S]*count\(\*\)[\s\S]*chart_provider_call_attempt_events[\s\S]*observed_at >= now\(\) - interval '24 hours'/i
);
assert.doesNotMatch(
  strictRetention,
  /'provider_calls_24h'[\s\S]{0,300}sum\(provider_call_count\)/i
);
assert.match(strictRetention, /payload_expires_at <= now\(\)[\s\S]*SYNC_PAYLOAD_EXPIRED/i);
assert.match(strictRetention, /payload_expires_at > now\(\)[\s\S]*for update skip locked/i);
assert.match(strictRetention, /replay_external_sync_event[\s\S]*payload_redacted_at is not null[\s\S]*SYNC_PAYLOAD_EXPIRED/i);
assert.match(providerConcurrency, /pg_advisory_xact_lock[\s\S]*chart-provider-call:/i);
assert.match(
  providerConcurrency,
  /provider_call_count = greatest\([\s\S]*chart_provider_call_events\.provider_call_count[\s\S]*excluded\.provider_call_count/i
);
assert.match(providerConcurrency, /external_sync_operational_payload[\s\S]*jsonb_strip_nulls\(jsonb_build_object/i);
for (const privateField of ["email", "name", "birth_date", "birth_time", "paid_amount", "marketing_consent", "chart_url", "plan"]) {
  const allowlistFunction = providerConcurrency.slice(
    providerConcurrency.indexOf("create or replace function public.external_sync_operational_payload"),
    providerConcurrency.indexOf("revoke all on function public.external_sync_operational_payload")
  );
  assert.doesNotMatch(allowlistFunction, new RegExp(`'${privateField}'`, "i"));
}

assert.match(operations, /create table if not exists public\.runtime_request_events/i);
assert.match(operations, /create or replace function public\.runtime_health_snapshot/i);
assert.match(operations, /create table if not exists public\.runtime_alerts/i);
assert.match(operations, /create or replace function public\.evaluate_runtime_alerts/i);
assert.match(operations, /lumis-runtime-alerts/);
assert.match(operations, /create or replace function public\.purge_runtime_operational_data/i);
assert.match(operations, /lumis-runtime-retention/);
assert.match(operations, /lumis-external-sync-daily-report/);
assert.doesNotMatch(operations, /external-sync-retry[\s\S]*net\.http_post/i);
assert.match(schedulerStatus, /runtime_scheduler_status/i);
assert.match(schedulerStatus, /cron\.job_run_details/i);
assert.match(schedulerStatus, /all_configured/i);
assert.match(schedulerStatus, /all_have_successful_run/i);
assert.doesNotMatch(schedulerStatus, /job\.command|detail\.command/i);
assert.match(schedulerStatus, /revoke all on function public\.runtime_scheduler_status\(\)[\s\S]*anon, authenticated/i);

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
