#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "7767b69bef7e33f6aa898ca9a0c14ca2ce3b7c12";
const read = (path) => readFileSync(path, "utf8");
const app = read("apps/mobile/App.tsx");
const route = read("apps/mobile/src/features/dice/CustomerDiceRitualRoute.tsx");
const screen = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const gate = read("apps/mobile/src/features/dice/dicePreRollValidation.ts");
const controller = read("apps/mobile/src/services/diceCustomerInterpretationController.ts");
const registry = read("apps/mobile/src/services/diceFounderFixtureRegistry.ts");
const launcher = read("scripts/start-s2-t337-customer-dice-ssd.sh");
const control = JSON.parse(read("config/s2-t337-customer-dice-rc.json"));
const seal = JSON.parse(read("config/s2-t337-customer-dice-rc-seal.json"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.match(app, /DICE_RITUAL_ENABLED \? CustomerDiceRitualRoute : LumisDiceScreen/);
assert.doesNotMatch(app, /DICE_RITUAL_ENABLED \? DiceRitualScreen/);
assert.match(route, /<DiceRitualScreen/);
assert.match(route, /requireClosedFixtureRegistry/);
assert.match(route, /effectsAuthorized=\{false\}/);
assert.match(route, /isCurrentDiceCustomerEnvelope/);
assert.match(route, /latest\?\.request_key === requestKey/);
assert.doesNotMatch(route, /setScreen|fetch\(|azure/i);
assert.match(route, /createDiceMobileSupabaseTransport/);
assert.doesNotMatch(route, /onReflect\s*\(/, "route must not navigate to Chat automatically");

const ready = screen.slice(screen.indexOf("const beginReady"), screen.indexOf("const performThrow"));
const validation = ready.indexOf("validateDicePreRollQuestion");
assert.ok(validation >= 0, "real Dice path validates before roll");
for (const effect of ["transition(\"READY\")", "cradleTick()", "Accelerometer.isAvailableAsync"]) {
  assert.ok(ready.indexOf(effect) > validation, `${effect} follows validation`);
}
assert.match(screen, /if \(effectsAuthorized\) \{/);
assert.match(screen, /sessionRollsRef\.current = \[/);
assert.match(screen, /void persistThrow\(lastThrowRef\.current\)/);
assert.match(screen, /accessibilityLabel="Dice interpretation"/);
assert.match(screen, /nestedScrollEnabled showsVerticalScrollIndicator/);
assert.match(screen, /label="Roll again"/);
assert.match(screen, /label="Reflect in Chat"/);

assert.match(gate, /require_closed_fixture_registry/);
assert.match(gate, /resolveDiceFounderFixtureByExactText/);
assert.match(registry, /DICE_FOUNDER_FIXTURES_BY_EXACT_TEXT/);
assert.equal((registry.match(/fixture_id: "dice-founder-en-/g) ?? []).length, 20);
assert.equal((registry.match(/fixture_id: "dice-founder-zh-/g) ?? []).length, 20);
assert.doesNotMatch(registry, /我去到澳洲應該讀書定係做嘢？/);
assert.match(registry, /我個application 會唔會批？幾時會批？/);
assert.match(registry, /我個application幾時會批？/);

for (const state of ["completed", "safety", "fallback", "technical_error"]) assert.match(controller, new RegExp(`"${state}"`));
assert.match(controller, /provider_calls: 0, persistence_writes: 0, units_charged: 0/);
assert.doesNotMatch(controller, /fetch\(|XMLHttpRequest|supabase|azure|openai|anthropic/i);

for (const protectedPath of [
  "apps/mobile/src/screens/LumisHomeScreen.tsx",
  "apps/mobile/src/screens/LumisAuthScreen.tsx",
  "apps/mobile/src/features/careCircle/CareCircleScreen.tsx",
]) {
  execFileSync("git", ["diff", "--exit-code", BASE, "--", protectedPath], { stdio: "pipe" });
}

assert.match(launcher, /lumis_resolve_worktree_root/);
assert.match(launcher, /Dependencies\/pnpm-store/);
assert.match(launcher, /BuildCaches\/Expo\/s2-t337/);
assert.match(launcher, /EXPO_PUBLIC_DICE_CUSTOMER_LOCAL_FIXTURE/);
assert.match(launcher, /EXPO_PUBLIC_SUPABASE_URL=/);
assert.doesNotMatch(launcher, /kill |pkill|killall|curl|wget|AZURE_|OPENAI_/i);

assert.equal(control.base_commit, BASE);
assert.equal(control.fixture_registry_sha256, "a6f2700b5b689bc00a130bde083e2efbce1a83ac64df8ddaee5565b2f2e9d211");
assert.equal(control.fixture_mode.provider_calls, 0);
assert.equal(control.fixture_mode.persistence_writes, 0);
assert.equal(control.fixture_mode.units_charged, 0);
assert.equal(control.remote_operations, false);
assert.equal(seal.base_commit, BASE);
assert.deepEqual(seal.files.map((file) => file.path), seal.files.map((file) => file.path).sort());
for (const file of seal.files) assert.equal(file.sha256, sha256(readFileSync(file.path)), `${file.path} drifted`);
assert.equal(
  seal.package_sha256,
  sha256(seal.files.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).join("")),
  "T337 package seal drifted",
);

console.log("S2-T337 canonical customer Dice RC contract passed");
