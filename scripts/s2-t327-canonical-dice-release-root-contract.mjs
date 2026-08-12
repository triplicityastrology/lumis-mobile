#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SUCCESS, validateRoot } from "./lib/s2-t327-canonical-dice-release-root.mjs";

const { manifest } = validateRoot();
const screen = readFileSync("apps/mobile/src/features/dice/DiceRitualScreen.tsx", "utf8");
const beginReady = screen.slice(screen.indexOf("const beginReady"), screen.indexOf("const performThrow"));
const gate = beginReady.indexOf("validateDicePreRollQuestion");
const rejectionReturn = beginReady.indexOf("return;", gate);
assert(gate >= 0 && rejectionReturn > gate, "actual Dice screen must reject before roll setup");
for (const effect of [
  "activeQuestionRef.current =",
  "transition(\"READY\")",
  "cradleTick()",
  "Accelerometer.isAvailableAsync",
]) assert(beginReady.indexOf(effect) > rejectionReturn, `${effect} must remain unreachable for rejected questions`);
for (const forbidden of ["performThrow", "launch(", "persistThrow(", "onInterpretationRequestedRef.current", "sessionRollsRef.current ="]) {
  assert(!beginReady.slice(gate, rejectionReturn).includes(forbidden), `${forbidden} entered rejected-question path`);
}
assert.deepEqual(manifest.rejected_question_effects, {
  animation_starts: 0,
  random_results_generated: 0,
  ai_clients_constructed: 0,
  transport_calls: 0,
  history_writes: 0,
  session_writes: 0,
  persistence_writes: 0,
  units_charged: 0,
  navigation_actions: 0,
});
assert.deepEqual(manifest.gates, {
  deployment_authorized: false,
  migration_authorized: false,
  provider_traffic_authorized: false,
  signing_authorized: false,
  remote_calls: 0,
  provider_calls: 0,
  model_invocations: 0,
});
assert.equal(manifest.dependencies.t313_founder_signer.operational_signing_authorized, false);
assert.equal(manifest.dependencies.t316_on_dice_interpretation.surface, "existing_dice_result_card");
assert.equal(manifest.product_path.pre_roll_enforcement, "actual_dice_begin_ready_before_roll");
assert.equal(manifest.authority_status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.authority_status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

for (const path of ["docs/qa/S2-T279-final-dice-technical-window.md", "docs/qa/S2-T287-canonical-v4-dice-deployment.md"]) {
  assert.doesNotMatch(readFileSync(path, "utf8"), /microsoft(?:-signed)?\s+receipt/iu);
}

const preflight = spawnSync(process.execPath, ["scripts/s2-t327-canonical-dice-release-preflight.mjs"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.equal(preflight.stdout, `${SUCCESS}\n`);
assert.equal(preflight.stderr, "");
process.stdout.write("S2_T327_CANONICAL_DICE_RELEASE_ROOT_OK\n");
