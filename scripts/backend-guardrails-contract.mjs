import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guardrails = readFileSync("supabase/migrations/0020_backend_runtime_guardrails.sql", "utf8");
const operations = readFileSync("supabase/migrations/0021_runtime_observability_and_schedules.sql", "utf8");
const chatEdge = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const profileEdge = readFileSync("supabase/functions/profile/index.ts", "utf8");
const mobileChat = readFileSync("apps/mobile/src/services/chat.ts", "utf8");
const mobileApp = readFileSync("apps/mobile/App.tsx", "utf8");

assert.match(guardrails, /monthly_balance_user_period_start_idx[\s\S]*\(user_id, period_start\)/i);
assert.match(guardrails, /monthly_balance_user_period_start_unique[\s\S]*unique using index monthly_balance_user_period_start_idx/i);
assert.match(guardrails, /chat_messages_user_created_idx[\s\S]*\(user_id, created_at desc\)/i);
assert.match(guardrails, /chat_messages_user_client_msg_idx[\s\S]*role = 'user'/i);
assert.match(guardrails, /pg_advisory_xact_lock[\s\S]*CHAT_IDEMPOTENCY_CONFLICT/i);
assert.match(guardrails, /assistant_message[\s\S]*duplicate/i);
assert.match(guardrails, /create or replace function public\.check_api_rate_limit/i);
assert.match(guardrails, /chart_provider_call_events[\s\S]*review_pending/i);
assert.match(guardrails, /redact_completed_external_sync_payload[\s\S]*payload_redacted_at/i);
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

console.log("backend guardrail contract checks passed");
