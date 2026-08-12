#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { CONTROL_PATH, SEAL_PATH, fileHashes, packageSha, readJson } from "./lib/s2-t312-closed-dice-registry.mjs";

const control = readJson(CONTROL_PATH);
const seal = readJson(SEAL_PATH);
const require = createRequire(import.meta.url);
const compiledRegistry = require("../.tmp/dice-live-result-adapter-tests/apps/mobile/src/services/diceFounderFixtureRegistry.js");
const computedRegistrySha = createHash("sha256").update(`${JSON.stringify({
  version: compiledRegistry.DICE_FOUNDER_FIXTURE_REGISTRY_VERSION,
  fixtures: compiledRegistry.DICE_FOUNDER_FIXTURES
})}\n`).digest("hex");
assert.deepEqual(seal.files, fileHashes());
assert.equal(seal.package_sha256, packageSha(control, seal.files));
assert.equal(control.registry.fixture_total, 40);
assert.equal(control.registry.english, 20);
assert.equal(control.registry.zh_hant, 20);
assert.equal(control.registry.excluded_authoring_id, "ZH04");
assert.equal(control.registry.excluded_exact_text, "我去到澳洲應該讀書定係做嘢？");
assert.equal(control.registry.zh08, "bundled_question_rejection");
assert.equal(control.registry.zh09, "accepted_single_question_control");
assert.equal(computedRegistrySha, control.registry.sha256);
assert.equal(compiledRegistry.DICE_FOUNDER_FIXTURE_REGISTRY_SHA256, control.registry.sha256);
assert.equal(new Set(compiledRegistry.DICE_FOUNDER_FIXTURES.map((fixture) => fixture.fixture_id)).size, 40);
for (const fixture of compiledRegistry.DICE_FOUNDER_FIXTURES) {
  assert.deepEqual(compiledRegistry.resolveDiceFounderFixture(fixture.fixture_id), fixture);
}

const adapter = readFileSync("apps/mobile/src/services/diceLiveResultAdapter.ts", "utf8");
assert.match(adapter, /resolveDiceFounderFixture/);
assert.match(adapter, /fixture\.exact_text !== request\.question/);
assert.doesNotMatch(adapter, /\^dice-founder-\(\?:en\|zh\)-\\d/);

for (const path of [
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/screens/LumisDiceScreen.tsx"
]) {
  const current = readFileSync(path);
  const base = execFileSync("git", ["show", `cf8386a9176ed7fde0b6008a2628c2785bce2c64:${path}`]);
  assert.deepEqual(current, base, `${path} must remain byte-identical`);
}
assert.equal(createHash("sha256").update(readFileSync("apps/mobile/src/features/dice/DiceRitualScreen.tsx")).digest("hex"), "b2f2eeda34df3f408d22f12bbb582e09ebc0e3ef738dde3d1b43130138faa5c6");
assert.equal(control.effects.remote_calls, 0);
assert.equal(control.effects.provider_calls, 0);
assert.equal(control.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");
console.log(`S2_T312_CLOSED_DICE_REGISTRY_OK package_sha256=${seal.package_sha256}`);
