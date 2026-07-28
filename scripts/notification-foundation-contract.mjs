import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/0033_inactive_notification_foundation.sql",
  "utf8"
);
const edgeFunction = readFileSync(
  "supabase/functions/notification-device/index.ts",
  "utf8"
);
const preview = readFileSync(
  "apps/mobile/src/features/notifications/NotificationCenterScreen.tsx",
  "utf8"
);
const carePreview = readFileSync(
  "apps/mobile/src/features/careCircle/CareCircleScreen.tsx",
  "utf8"
);
const architecture = readFileSync(
  "docs/architecture/inactive-notification-foundation.md",
  "utf8"
);

const registryBlock = extractCreateTable(migration, "notification_type_registry");
assert.match(registryBlock, /enabled boolean not null default false/i);
assert.match(registryBlock, /check \(enabled = false\)/i);
assert.match(registryBlock, /'care_circle_check_in'/);
assert.match(registryBlock, /'care_circle_reminder'/);

for (const forbiddenType of [
  "marketing",
  "billing",
  "payment",
  "ai",
  "emergency",
  "urgent",
  "generic",
  "carer_acknowledgement"
]) {
  assert.doesNotMatch(registryBlock, new RegExp(`'${forbiddenType}`, "i"));
}

assert.match(migration, /drop policy if exists "users can read own notifications"/i);
assert.match(migration, /revoke all on table public\.notifications from anon, authenticated/i);

for (const table of [
  "notification_type_registry",
  "notification_account_preferences",
  "notification_type_preferences",
  "notification_device_endpoints",
  "notification_registration_requests",
  "notification_audit_events"
]) {
  assert.match(
    migration,
    new RegExp(`alter table public\\.${table} enable row level security`, "i")
  );
  assert.match(
    migration,
    new RegExp(
      `revoke all on table public\\.${table} from anon, authenticated`,
      "i"
    )
  );
}

const endpointBlock = extractCreateTable(
  migration,
  "notification_device_endpoints"
);
assert.match(endpointBlock, /references public\.users\(id\) on delete cascade/i);
assert.match(endpointBlock, /token_fingerprint text not null/i);
assert.match(endpointBlock, /token_ciphertext text not null/i);
assert.doesNotMatch(endpointBlock, /\bprovider_token\b|\braw_token\b|\bemail\b/i);
assert.match(endpointBlock, /unique \(user_id, installation_id\)/i);
assert.match(endpointBlock, /unique \(provider, token_fingerprint\)/i);

assert.match(migration, /last_seen_at <= now\(\) - interval '90 days'/i);
assert.match(migration, /retention_until <= now\(\)/i);
assert.match(migration, /created_at \+ interval '90 days'/i);
assert.match(migration, /on delete set null/i);
assert.match(migration, /remove_notification_devices_for_account/i);
assert.match(migration, /p_reason not in \([\s\S]+permission_revoked[\s\S]+provider_invalid[\s\S]+account_deleted/is);
assert.match(migration, /NOTIFICATION_REQUEST_ID_CONFLICT/);
assert.match(migration, /pg_advisory_xact_lock/);

const auditBlock = extractCreateTable(migration, "notification_audit_events");
assert.doesNotMatch(
  auditBlock,
  /\btitle\b|\bbody\b|\bmessage\b|\bcontent\b|\bbirth\b|\bemail\b|\bchart\b/i
);
assert.match(migration, /notification_audit_metadata_is_safe/i);
assert.match(migration, /'inactive_90_days'/);
assert.match(migration, /'user_opt_out'/);
assert.match(migration, /removed_count'\) = 'number'/i);
for (const forbiddenMetadataKey of [
  "title",
  "body",
  "message",
  "content",
  "email",
  "birth_data",
  "chart_json",
  "provider_token"
]) {
  assert.doesNotMatch(
    extractFunction(migration, "public.notification_audit_metadata_is_safe"),
    new RegExp(`'${forbiddenMetadataKey}'`, "i")
  );
}

assert.match(edgeFunction, /userClient\.auth\.getUser\(\)/);
assert.match(edgeFunction, /NOTIFICATION_TOKEN_ENCRYPTION_KEY/);
assert.match(edgeFunction, /AES-GCM/);
assert.match(edgeFunction, /SHA-256/);
assert.match(edgeFunction, /digestRegistrationRequest/);
assert.match(edgeFunction, /digestUnregistrationRequest/);
assert.doesNotMatch(edgeFunction, /body!?\??\.request_digest/);
assert.match(edgeFunction, /register_notification_device_endpoint/);
assert.match(edgeFunction, /unregister_notification_device_endpoint/);
assert.doesNotMatch(
  edgeFunction,
  /console\.(?:log|error|warn)|JSON\.stringify\(body\)|provider_token[^]*console/i
);

for (const forbiddenDeliveryPrimitive of [
  /cron\.schedule/i,
  /pg_net/i,
  /net\.http/i,
  /fetch\([^)]*(?:expo|apple|google|fcm|apns)/i,
  /sendPushNotification/i,
  /scheduleNotification/i
]) {
  assert.doesNotMatch(migration, forbiddenDeliveryPrimitive);
  assert.doesNotMatch(edgeFunction, forbiddenDeliveryPrimitive);
}

assert.match(preview, /Preview · notifications are not active/);
assert.match(carePreview, /Care Circle is a preview\./);
assert.match(architecture, /not deployed/i);
assert.match(architecture, /no scheduler/i);
assert.match(architecture, /90 days/i);
assert.match(architecture, /staging/i);

console.log("Inactive notification foundation source contracts passed");

function extractCreateTable(source, tableName) {
  const start = source.indexOf(`create table public.${tableName}`);
  assert.ok(start >= 0, `missing table ${tableName}`);
  const end = source.indexOf("\n);", start);
  assert.ok(end > start, `unterminated table ${tableName}`);
  return source.slice(start, end);
}

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `missing function ${functionName}`);
  const end = source.indexOf("\n$$;", start);
  assert.ok(end > start, `unterminated function ${functionName}`);
  return source.slice(start, end);
}
