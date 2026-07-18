import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0014_authoritative_account_entitlements.sql", "utf8");
const privacyMigration = readFileSync("supabase/migrations/0015_entitlement_provider_privacy.sql", "utf8");
const providerEventMigration = readFileSync(
  "supabase/migrations/0017_persona_policy_and_entitlement_events.sql",
  "utf8"
);
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
assert.match(providerEventMigration, /create table if not exists public\.entitlement_provider_events/i);
assert.match(providerEventMigration, /primary key \(provider, provider_event_id\)/i);
assert.match(providerEventMigration, /enable row level security/i);
assert.match(
  providerEventMigration,
  /revoke all on table public\.entitlement_provider_events from anon, authenticated, service_role/i
);
assert.match(
  providerEventMigration,
  /grant select, insert on table public\.entitlement_provider_events to service_role/i
);
assert.doesNotMatch(providerEventMigration, /grant all on table public\.entitlement_provider_events/i);
assert.doesNotMatch(providerEventMigration, /raw_payload|payload_json/i);
assert.match(providerEventMigration, /payload_digest text not null/i);
assert.match(providerEventMigration, /create or replace function public\.apply_entitlement_provider_event/i);
assert.match(providerEventMigration, /if auth\.role\(\) <> 'service_role'/i);
assert.match(providerEventMigration, /on conflict \(provider, provider_event_id\) do nothing/i);
assert.match(providerEventMigration, /'duplicate', true, 'applied', false/i);
assert.match(
  providerEventMigration,
  /excluded\.provider_event_at >= public\.account_entitlements\.provider_event_at/i
);
assert.match(providerEventMigration, /grant execute on function public\.apply_entitlement_provider_event[\s\S]+to service_role/i);
assert.doesNotMatch(
  providerEventMigration,
  /grant execute on function public\.apply_entitlement_provider_event[\s\S]{0,240}to authenticated/i
);

const eventHistory = [];
let currentEvent = null;
function applyFixtureEvent(event) {
  if (eventHistory.some((saved) => saved.id === event.id)) return { duplicate: true, applied: false };
  eventHistory.push(event);
  if (!currentEvent || event.at >= currentEvent.at) {
    currentEvent = event;
    return { duplicate: false, applied: true };
  }
  return { duplicate: false, applied: false };
}

assert.deepEqual(applyFixtureEvent({ id: "event-new", at: 20, plan: "prime" }), { duplicate: false, applied: true });
assert.deepEqual(applyFixtureEvent({ id: "event-new", at: 20, plan: "prime" }), { duplicate: true, applied: false });
assert.deepEqual(applyFixtureEvent({ id: "event-old", at: 10, plan: "essential" }), { duplicate: false, applied: false });
assert.equal(currentEvent.plan, "prime");
assert.equal(eventHistory.length, 2);

console.log("billing entitlement contract checks passed");
