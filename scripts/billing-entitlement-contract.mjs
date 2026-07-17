import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0014_authoritative_account_entitlements.sql", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");

assert.match(migration, /create table if not exists public\.account_entitlements/i);
assert.match(migration, /account_entitlements_product_matches_tier/i);
assert.match(migration, /status in \('active', 'grace_period', 'expired', 'cancelled'\)/i);
assert.match(migration, /valid_until is null or valid_until > valid_from/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /users can read own account entitlement/i);
assert.match(migration, /after insert on public\.monthly_balance/i);
assert.match(migration, /on conflict \(user_id\) do nothing/i);
assert.match(migration, /create or replace function public\.resolve_active_plan_tier/i);
assert.match(migration, /valid_until is null or entitlement\.valid_until > now\(\)/i);
assert.match(migration, /return coalesce\(resolved_plan, 'starter'\)/i);
assert.match(accountState, /rpc\("resolve_active_plan_tier", \{ p_user_id: userId \}\)/);
assert.doesNotMatch(accountState, /derivePlanTier|select\("allocated, remaining"\)/);

console.log("billing entitlement contract checks passed");
