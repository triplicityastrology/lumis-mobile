import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migration-drafts/0031_internal_account_deletion_finalizer.sql",
  "utf8"
);
const finalizer = readFileSync(
  "supabase/functions/account-deletion-finalize/index.ts",
  "utf8"
);
const liveGolden = readFileSync("scripts/golden-chart-live.mjs", "utf8");

assert.match(migration, /internal_deletion_processing/i);
assert.doesNotMatch(migration, /end if;\s+end if;/i);
assert.match(migration, /internal_claim_expires_at <= now\(\)/i);
assert.match(migration, /for update skip locked/i);
assert.match(migration, /interval '15 minutes'/i);
assert.match(migration, /internal_attempt_count >= 3/i);
assert.match(migration, /interval '1 hour'/i);
assert.match(migration, /interval '3 hours'/i);
assert.match(migration, /then 'needs_manual_review'/i);
assert.match(migration, /status = 'internally_deleted'|'status', 'internally_deleted'/i);
assert.match(migration, /prepare_internal_account_deletion/i);
assert.match(migration, /delete from public\.message_usage where user_id = p_user_id/i);
assert.match(migration, /delete from public\.runtime_request_events where user_id = p_user_id/i);
assert.match(migration, /delete from public\.users where id = p_user_id/i);
assert.match(migration, /event\.status not in \('delivered', 'manually_resolved'\)/i);
assert.match(migration, /auth\.role\(\) <> 'service_role'/i);
assert.match(
  migration,
  /revoke all on function public\.claim_internal_account_deletions\(integer\)[\s\S]*from public, anon, authenticated/i
);
assert.match(
  migration,
  /revoke all on function public\.complete_internal_account_deletion\(uuid, uuid\)[\s\S]*from public, anon, authenticated/i
);

assert.match(finalizer, /INTERNAL_ACCOUNT_DELETION_ENABLED/);
assert.match(finalizer, /!== "true"/);
assert.match(finalizer, /INTERNAL_ACCOUNT_DELETION_CRON_SECRET/);
assert.match(finalizer, /X-Lumis-Internal-Deletion-Secret/);
assert.match(finalizer, /auth\.admin\.deleteUser\(claim\.user_id\)/);
assert.match(finalizer, /prepare_internal_account_deletion/);
assert.match(finalizer, /APPLICATION_DATA_PREPARE_FAILED/);
assert.match(finalizer, /authDeleteError\.status !== 404/);
assert.match(finalizer, /complete_internal_account_deletion/);
assert.match(finalizer, /fail_internal_account_deletion/);
assert.doesNotMatch(finalizer, /error instanceof Error \? error\.message/);

assert.match(liveGolden, /golden_unknown_time_contract/);
assert.match(liveGolden, /precision !== "no_birth_time"/);
assert.match(liveGolden, /chart\?\.angles\?\.ascendant/);
assert.match(liveGolden, /chart\?\.angles\?\.mediumCoeli/);
assert.match(liveGolden, /point\.house != null/);
assert.match(liveGolden, /accuracyStatus: "pending_reference"/);

console.log("account deletion finalizer and signed unknown-time contract checks passed");
