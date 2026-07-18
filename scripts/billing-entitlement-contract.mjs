import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0014_authoritative_account_entitlements.sql", "utf8");
const privacyMigration = readFileSync("supabase/migrations/0015_entitlement_provider_privacy.sql", "utf8");
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
assert.doesNotMatch(accountState, /from\("account_entitlements"\)/);
assert.match(privacyMigration, /rename column provider_entitlement_id to provider_event_id/i);
assert.match(privacyMigration, /unique index if not exists account_entitlements_provider_event_idx/i);
assert.match(privacyMigration, /new\.updated_at = now\(\)/i);
assert.match(privacyMigration, /before update on public\.account_entitlements/i);
assert.match(privacyMigration, /drop policy if exists "users can read own account entitlement"/i);
assert.match(privacyMigration, /revoke all on table public\.account_entitlements from anon, authenticated/i);
assert.match(privacyMigration, /grant all on table public\.account_entitlements to service_role/i);
assert.doesNotMatch(privacyMigration, /grant select on table public\.account_entitlements to authenticated/i);

console.log("billing entitlement contract checks passed");
