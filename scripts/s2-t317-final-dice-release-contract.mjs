#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRelease } from "./lib/s2-t317-final-dice-release.mjs";

const { manifest } = validateRelease();
const registry = JSON.parse(readFileSync("config/s2-t314-founder-fixture-registry.json", "utf8"));
const adapter = readFileSync("apps/mobile/src/services/diceLiveResultAdapter.ts", "utf8");
const screen = readFileSync("apps/mobile/src/features/dice/DiceRitualScreen.tsx", "utf8");
const activeControls = [
  readFileSync("config/s2-t313-founder-signer-trust-anchor.json", "utf8"),
  readFileSync("config/s2-t314-final-disabled-deploy-control.json", "utf8"),
  readFileSync("config/s2-t315-authorization-day-control.json", "utf8"),
  readFileSync("scripts/lib/s2-t314-final-disabled-deploy.mjs", "utf8"),
  readFileSync("scripts/lib/s2-t315-authorization-day.mjs", "utf8"),
].join("\n");

assert.equal(registry.fixture_total, 40);
assert.deepEqual(registry.language_totals, { en: 20, "zh-Hant": 20 });
assert(!registry.fixtures.some((fixture) => fixture.authoring_id === "ZH04"));
assert(registry.fixtures.some((fixture) => fixture.authoring_id === "ZH08"));
assert(registry.fixtures.some((fixture) => fixture.authoring_id === "ZH09"));
assert.match(adapter, /resolveDiceFounderFixture/);
assert.match(adapter, /fixture\.exact_text !== request\.question/);
assert.doesNotMatch(adapter, /\^dice-founder-/);
assert.match(activeControls, /Lumis Founder Deployment Approver/);
assert.match(activeControls, /issuer_public_key_spki_sha256/);
assert.match(activeControls, /issuer_signature_base64/);
assert.doesNotMatch(activeControls, /microsoft_signing_key_sha256|microsoft_signature_base64|DICE_CHAT_PRESENTATION_AUTHORITY_REQUIRED/iu);
for (const invariant of ["Roll again", "Reflect in Chat", "DiceInterpretationCard", "buildReflectionPrompt", "isCurrentDiceInterpretationRequest"]) {
  assert(screen.includes(invariant), `missing on-Dice invariant: ${invariant}`);
}
assert.equal(manifest.product_path.stays_on_dice, true);
assert.equal(manifest.product_path.chat_requires_explicit_reflect_action, true);
assert.equal(manifest.operations.remote_calls_default, 0);
assert.equal(manifest.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.deepEqual(manifest.required_external_operational_receipts, [
  "founder_signed_default_off_deployment_receipt",
  "founder_signed_migration_0039_receipt",
  "founder_signed_technical_80_traffic_receipt",
]);
console.log("S2-T317 final Dice release contract passed");
