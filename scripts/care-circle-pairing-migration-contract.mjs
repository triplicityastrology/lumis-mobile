import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/0034_reusable_care_pairing_operations.sql",
  "utf8"
);
const foundation = readFileSync(
  "supabase/migrations/0032_care_circle_backend_foundation.sql",
  "utf8"
);

for (const operation of [
  "code_create",
  "code_revoke",
  "code_consume",
  "relationship_accept",
  "relationship_decline",
  "relationship_remove",
  "settings_pause",
  "settings_resume"
]) {
  assert.match(migration, new RegExp(`'${operation}'`));
}

for (const rpc of [
  "create_care_pairing_code_backend",
  "revoke_care_pairing_code_backend",
  "consume_care_pairing_code_backend",
  "accept_care_relationship_backend",
  "decline_care_relationship_backend",
  "update_care_pause_backend",
  "remove_care_relationship_backend"
]) {
  const block = extractFunction(migration, `public.${rpc}`);
  assert.match(block, /assert_care_circle_backend_request/);
  assert.match(
    migration,
    new RegExp(
      `revoke all on function public\\.${rpc}[^;]+from public, anon, authenticated`,
      "is"
    )
  );
  assert.match(
    migration,
    new RegExp(`grant execute on function public\\.${rpc}[^;]+to service_role`, "is")
  );
}

assert.match(migration, /auth\.role\(\) <> 'service_role'/);
assert.match(migration, /care_pairing_code_events/);
assert.match(migration, /on delete cascade/);
assert.match(migration, /pairing_code_created/);
assert.match(migration, /pairing_code_rotated/);
assert.match(migration, /pairing_code_revoked/);
assert.match(migration, /pairing_code_used/);
assert.doesNotMatch(
  extractCreateTable(migration, "care_pairing_code_events"),
  /\bcode_hash\b|\braw_code\b|\bpairing_code\b|\bqr_payload\b|\bmetadata\b/i
);

const createBlock = extractFunction(
  migration,
  "public.create_care_pairing_code_backend"
);
assert.match(createBlock, /pg_advisory_xact_lock[\s\S]+care-pairing-code:/);
assert.match(createBlock, /status = 'revoked'[\s\S]+insert into public\.care_link_codes/i);
assert.match(createBlock, /now\(\) \+ interval '1 hour'/i);
assert.match(createBlock, /care_operation_requests/);

const consumeBlock = extractFunction(
  migration,
  "public.consume_care_pairing_code_backend"
);
assert.match(consumeBlock, /status = 'active'[\s\S]+expires_at > now\(\)[\s\S]+for update/i);
assert.match(consumeBlock, /pending_caree_acceptance/);
assert.match(consumeBlock, /insert into public\.care_relationships/);
assert.match(consumeBlock, /insert into public\.care_relationship_events/);
assert.match(consumeBlock, /insert into public\.care_pairing_code_events/);
assert.match(consumeBlock, /insert into public\.care_operation_requests/);
assert.doesNotMatch(consumeBlock, /status\s*=\s*'consumed'/i);
assert.doesNotMatch(consumeBlock, /request_expires_at\s*,?[\s\S]{0,180}v_code\.expires_at/i);

const acceptBlock = extractFunction(
  migration,
  "public.accept_care_relationship_backend"
);
assert.match(acceptBlock, /care-capacity:/);
assert.match(acceptBlock, /where caree_user_id = p_actor_user_id[\s\S]+status = 'active'/i);
assert.match(acceptBlock, /if v_active_count >= 5/i);
assert.match(acceptBlock, /raise exception '48012'/i);

const declineBlock = extractFunction(
  migration,
  "public.decline_care_relationship_backend"
);
assert.match(declineBlock, /caree_user_id = p_actor_user_id/);
assert.match(declineBlock, /status = 'declined'/);

const pauseBlock = extractFunction(
  migration,
  "public.update_care_pause_backend"
);
assert.match(pauseBlock, /can_act_as_caree/);
assert.match(pauseBlock, /paused_at/);
assert.match(pauseBlock, /paused_until/);

const removeBlock = extractFunction(
  migration,
  "public.remove_care_relationship_backend"
);
assert.match(removeBlock, /caree_user_id = p_actor_user_id[\s\S]+carer_user_id = p_actor_user_id/);
assert.match(removeBlock, /relationship_removed/);
assert.match(removeBlock, /care_checkin_rounds[\s\S]+close_reason = 'relationship_removed'/i);
assert.match(
  extractCreateTable(migration, "care_pairing_code_events"),
  /references public\.users\(id\) on delete cascade/i
);

assert.match(
  migration,
  /revoke all on function public\.accept_care_relationship\(uuid, uuid, text\)[\s\S]+from authenticated/i
);
assert.match(
  migration,
  /revoke all on function public\.remove_care_relationship\(uuid, uuid, text\)[\s\S]+from authenticated/i
);

assert.match(foundation, /care_relationships_active_pair_idx/);
assert.match(foundation, /care_link_codes_one_active_per_caree_idx/);
assert.doesNotMatch(
  migration,
  /\bcron\.schedule\b|\bpg_net\b|\bnet\.http\b|\bexpo\b|\bapns\b|\bfcm\b/i
);
assert.doesNotMatch(
  migration,
  /\braw pairing code\b[^.]*\b(store|persist|log)\b|\bcode_plaintext\b|\bqr_payload\b/i
);

console.log("Reusable Care Circle pairing migration contracts passed");

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
