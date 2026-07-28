import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/0032_care_circle_backend_foundation.sql",
  "utf8"
);
const scaffold = readFileSync(
  "supabase/migrations/0003_care_notifications_usage.sql",
  "utf8"
);
const recovery = readFileSync(
  "docs/architecture/care-circle-backend-foundation.md",
  "utf8"
);
const preview = readFileSync(
  "apps/mobile/src/features/careCircle/CareCircleScreen.tsx",
  "utf8"
);

for (const status of [
  "pending_caree_acceptance",
  "active",
  "declined",
  "removed_by_caree",
  "removed_by_carer",
  "expired"
]) {
  assert.match(migration, new RegExp(`'${status}'`));
}

assert.match(migration, /CARE_LEGACY_REVOKED_ROWS_REQUIRE_REVIEW/);
assert.match(
  migration,
  /when 'pending_carer_acceptance' then 'pending_caree_acceptance'/i
);
assert.match(migration, /drop column if exists invitation_token_hash/i);
assert.match(migration, /create table if not exists public\.care_link_codes/i);
assert.match(migration, /expires_at <= issued_at \+ interval '1 hour'/i);
assert.match(migration, /expires_at \+ interval '90 days'/i);
assert.match(migration, /create unique index[^;]+care_link_codes_one_active_per_caree_idx/is);
assert.doesNotMatch(migration, /\braw_code\b|\bcode_plaintext\b/i);

assert.match(migration, /create table if not exists public\.care_check_settings/i);
assert.match(migration, /cadence_days in \(1, 2, 3, 7\)/i);
assert.match(migration, /grace_hours = 24/i);
assert.match(migration, /paused_until > paused_at/i);
assert.match(migration, /create table if not exists public\.care_checkin_rounds/i);
assert.match(migration, /'grace_period'/);
assert.match(migration, /carer_notice_count between 0 and 3/i);
assert.match(migration, /care_checkin_rounds_one_open_idx/i);

assert.match(migration, /resolve_care_circle_capability/i);
assert.match(migration, /v_plan in \('essential', 'prime'\)/i);
assert.match(migration, /account_mode in \('standard', 'carer_only', 'pending_intent'\)/i);

assert.match(migration, /create or replace function public\.accept_care_relationship/i);
assert.match(migration, /pg_advisory_xact_lock[\s\S]+care-capacity:/i);
assert.match(migration, /where caree_user_id = v_actor[\s\S]+status = 'active'/i);
assert.match(migration, /if v_active_count >= 5/i);
assert.match(migration, /raise exception '48012'/i);
assert.match(migration, /care_operation_requests/i);
assert.match(migration, /CARE_REQUEST_ID_CONFLICT/i);

assert.match(migration, /create or replace function public\.list_care_relationships/i);
const safeProjection = extractFunction(migration, "public.list_care_relationships");
assert.doesNotMatch(
  safeProjection,
  /code_hash|raw_chart|chart_json|birth_data|chat_messages|monthly_balance|provider_customer/i
);

for (const table of [
  "care_relationships",
  "care_relationship_events",
  "care_link_codes",
  "care_checkin_rounds",
  "care_operation_requests",
  "care_error_code_registry"
]) {
  assert.match(
    migration,
    new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, "i")
  );
}
assert.match(
  migration,
  /create policy "carees can read own check settings"[\s\S]+using \(user_id = auth\.uid\(\)\)/i
);

for (let code = 48004; code <= 48013; code += 1) {
  assert.match(migration, new RegExp(`'${code}'`));
}
assert.match(migration, /\('48012', 409,/);

for (const table of [
  "care_relationships",
  "care_link_codes",
  "care_check_settings",
  "care_checkin_rounds",
  "care_operation_requests"
]) {
  const tableBlock = extractCreateTable(
    table === "care_relationships" ? scaffold : migration,
    table
  );
  assert.match(
    tableBlock,
    /references public\.users\(id\) on delete cascade/i,
    `${table} must participate in account deletion`
  );
}

assert.match(
  migration,
  /and not exists \([\s\S]+remaining_relationship\.status = 'active'/i,
  "removing one carer must not cancel a Caree round while another active carer remains"
);
assert.doesNotMatch(migration, /cron\.schedule|net\.http|pg_net|\bexpo\b|\bapns\b|\bfcm\b/i);

assert.match(preview, /Care Circle is a preview\./);
assert.match(preview, /Check-ins, linking, codes, and reminders are not active in this build\./);
assert.match(recovery, /0032_care_circle_backend_foundation\.sql/);
assert.match(recovery, /forward-only/i);
assert.match(recovery, /static preview/i);
assert.match(recovery, /not executed locally/i);

console.log("Care Circle backend foundation source contracts passed");

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `missing function ${functionName}`);
  const end = source.indexOf("\n$$;", start);
  assert.ok(end > start, `unterminated function ${functionName}`);
  return source.slice(start, end);
}

function extractCreateTable(source, tableName) {
  const start = source.indexOf(`create table if not exists public.${tableName}`);
  assert.ok(start >= 0, `missing table ${tableName}`);
  const end = source.indexOf("\n);", start);
  assert.ok(end > start, `unterminated table ${tableName}`);
  return source.slice(start, end);
}
