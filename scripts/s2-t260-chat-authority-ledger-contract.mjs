import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/0040_chat_synthetic_authority_ledger.sql", import.meta.url), "utf8");
assert.match(migration, /0039 is reserved for T257 Dice/);
for (const table of ["chat_synthetic_authority_ledger", "chat_synthetic_fixture_claims"]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated, service_role;`));
}
assert.doesNotMatch(migration, /create\s+policy/iu);
for (const rpc of [
  "consume_chat_synthetic_authority_v1",
  "consume_chat_synthetic_fixture_v1",
  "close_chat_synthetic_authority_v1",
  "purge_chat_synthetic_authority_ledger_v1"
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
  assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*?to service_role;`));
}
assert.equal((migration.match(/auth\.role\(\) <> 'service_role' or auth\.uid\(\) is not null/g) ?? []).length, 4);
assert.ok((migration.match(/on conflict do nothing/g) ?? []).length >= 2);
assert.match(migration, /primary key \(authority_sha256, fixture_id\)/);
assert.match(migration, /unique \(review_package_sha256, run_id\)/);
assert.ok((migration.match(/interval '30 days'/g) ?? []).length >= 4);
assert.doesNotMatch(migration, /chat_messages|member_id|account_id|user_id|assistant_message|prompt_text|response_text|units_charged/iu);

console.log("S2-T260 authority migration/RPC RLS, atomicity, retention, and data-minimization seal passed");
