import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const audit = readFileSync(
  "docs/architecture/S2-T11-credit-expiry-backend-readiness-audit.md",
  "utf8"
);
const initialSchema = readFileSync("supabase/migrations/0001_initial_schema.sql", "utf8");
const runtimeGuardrails = readFileSync(
  "supabase/migrations/0020_backend_runtime_guardrails.sql",
  "utf8"
);
const entitlements = readFileSync(
  "supabase/migrations/0014_authoritative_account_entitlements.sql",
  "utf8"
);
const providerEvents = readFileSync(
  "supabase/migrations/0017_persona_policy_and_entitlement_events.sql",
  "utf8"
);
const products = readFileSync("packages/shared/src/config/products.ts", "utf8");
const billingWebhook = readFileSync("supabase/functions/billing-webhook/index.ts", "utf8");
const chatFunction = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const diceScreens = [
  readFileSync("apps/mobile/src/features/dice/DiceRitualScreen.tsx", "utf8"),
  readFileSync("apps/mobile/src/screens/LumisDiceScreen.tsx", "utf8")
].join("\n");

assert.match(initialSchema, /create table if not exists public\.monthly_balance/i);
assert.match(initialSchema, /pack_units int not null default 0/i);
assert.doesNotMatch(initialSchema, /credit_lots|credit_ledger_entries/i);
assert.match(runtimeGuardrails, /billing_period_key/i);
assert.match(runtimeGuardrails, /monthly_balance_user_billing_period_idx/i);
assert.match(entitlements, /create table if not exists public\.account_entitlements/i);
assert.match(providerEvents, /create table if not exists public\.entitlement_provider_events/i);
assert.match(products, /expiresMonths: 12/i);
assert.match(billingWebhook, /stage: "scaffold_only"/i);
assert.match(chatFunction, /billing_mode: "scaffold_no_charge"/i);
assert.doesNotMatch(diceScreens, /HK\$|price|balance|top.?up|purchase/i);

for (const requiredPolicy of [
  "unused monthly credits expire at the next billing boundary",
  "PAYG purchase creates its own lot and expires exactly 90 days",
  "earliest expiry first",
  "INSUFFICIENT_CREDITS",
  "legacy `pack_units`",
  "Push device tokens",
  "No billing UI, charging"
]) {
  assert.ok(
    audit.toLowerCase().includes(requiredPolicy.toLowerCase()),
    `audit must cover: ${requiredPolicy}`
  );
}

assert.match(audit, /timestamptz[\s\S]*compare them in\s+UTC/i);
assert.match(audit, /expires_at = effective_at \+ interval '90 days'/i);
assert.match(audit, /failed renewal event creates no new monthly credit lot/i);
assert.match(audit, /unique `\(user_id, idempotency_key\)`/i);
assert.match(audit, /concurrent charges cannot overspend/i);
assert.match(audit, /Never drop or reverse an applied migration/i);
assert.match(audit, /quarantine and report them; never\s+invent dates/i);
assert.match(audit, /Dice remains cost-blind/i);
assert.match(audit, /notification\/device-token tables remain absent from credit operations/i);
assert.doesNotMatch(audit, /migration has been applied|charging is live|billing is active/i);

console.log("credit expiry backend readiness contract checks passed");
