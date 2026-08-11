import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const boundary = read("apps/mobile/src/dev/founderDiceWindowContract.ts");
const fixtures = read("apps/mobile/src/dev/founderDiceWindowContract.fixtures.ts");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const web = read("scripts/start-s2-t269-founder-dice-web.sh");
const simulator = read("scripts/start-s2-t269-founder-dice-simulator.sh");
const guide = read("docs/qa/S2-T269-founder-dice-window.md");
const manifest = JSON.parse(read("config/s2-t269-founder-dice-window-manifest.json"));

assert.match(boundary, /T262_PACKAGE_SHA256 = "adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71"/);
assert.match(boundary, /T262_GATEWAY_INTERFACE = "dice_synthetic_gateway_port_v1"/);
assert.match(boundary, /ACCEPTED_TECHNICAL_EVIDENCE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_FOUNDER_WINDOW_AUTHORIZATION_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_FOUNDER_EXECUTION_EVIDENCE_SHA256_BY_FIXTURE.*Object\.freeze\(\{\}\)/);
assert.match(boundary, /logical_total: 80/);
assert.match(boundary, /en: 40; "zh-Hant": 40/);
assert.match(boundary, /fixture_total: 40/);
assert.match(boundary, /en: 20; "zh-Hant": 20/);
assert.match(boundary, /invocation_shape: "fixture_id_only"/);
assert.match(boundary, /provider_disabled_verified: true/);
assert.match(boundary, /STOP_S2_T269_TECHNICAL_EVIDENCE_PARTIAL/);
assert.match(boundary, /STOP_S2_T269_EXECUTION_NOT_AUTHORIZED/);
assert.match(boundary, /independentlyComputedSha256 !== acceptedExecutionEvidenceSha256/);
assert.match(boundary, /STOP_S2_T269_POST_WINDOW_NOT_DISABLED/);
assert.doesNotMatch(boundary, /fetch\s*\(|createClient\s*\(|supabase\.from|AsyncStorage|SecureStore|AZURE_|LUMIS_AI_ENABLED/i);
assert.doesNotMatch(boundary, /question\s*:/, "runtime boundary does not define a question-bearing invocation");

for (const marker of ["Technical evidence gate", "Prepare Founder questions", "Founder-window request", "Verify selected fixture result", "Close and disable"]) {
  assert.match(consoleSource, new RegExp(marker));
}
assert.match(consoleSource, /Complete all 40 slots first/);
assert.match(consoleSource, /20 EN \/ 20 zh-Hant/);
assert.match(consoleSource, /WAITING FOR ACCEPTED TECHNICAL EVIDENCE/);
assert.match(consoleSource, /WAITING FOR ACCEPTED FOUNDER WINDOW AUTHORIZATION/);
assert.match(consoleSource, /accessibilityLiveRegion="polite"/);
assert.match(consoleSource, /useWindowDimensions/);
assert.match(consoleSource, /fontScale >= 1\.2/);
assert.doesNotMatch(`${boundary}\n${consoleSource}`, /fetch\s*\(|createClient\s*\(|supabase\.from|DiceHistorySheet|Past Rolls|sessionRollsRef/i);
assert.doesNotMatch(boundary, /raw_provider_response|raw_prompt|raw_response/);

assert.match(fixtures, /partial: true/);
assert.match(fixtures, /status: "loading"/);
assert.match(fixtures, /raw_provider_response/);
assert.match(fixtures, /provider_access: true/);
assert.match(web, /FOUNDER_DICE_WINDOW_WEB_PORT:-8143/);
assert.match(web, /EXPECTED_BRANCH="codex\/s2-t269-founder-dice-window"/);
assert.match(web, /expo export --platform web --dev --clear/);
assert.match(web, /python3 -m http\.server 8143 --bind 127\.0\.0\.1/);
assert.match(simulator, /FOUNDER_DICE_WINDOW_SIMULATOR_PORT:-8144/);
assert.match(simulator, /expo start --ios --clear --port/);
assert.doesNotMatch(`${web}\n${simulator}`, /kill\s|pkill|killall|pnpm install|npm install/);

assert.equal(manifest.base_commit, "292391e08662db17086b1f89d1a4c21ecadfe148");
assert.equal(manifest.t262.commit, "b29809d57dafbddf589e96202aad20e070f48c86");
assert.equal(manifest.t262.package_sha256, "adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71");
assert.deepEqual(manifest.t262.technical_language_counts, { en: 40, "zh-Hant": 40 });
assert.deepEqual(manifest.founder_window.language_counts, { en: 20, "zh-Hant": 20 });
assert.deepEqual(manifest.founder_window.runtime_request_fields, ["fixture_id"]);
assert.equal(manifest.founder_window.accepted_technical_evidence_checked_in, false);
assert.equal(manifest.founder_window.accepted_founder_authorization_checked_in, false);
assert.deepEqual(manifest.effects, { provider_calls: 0, member_data: 0, history_reads: 0, persistence_writes: 0, units_charged: 0 });
assert.equal(manifest.web.port, 8143);
assert.equal(manifest.simulator.port, 8144);
assert.equal(manifest.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.match(guide, /## Founder browser path/);
assert.match(guide, /## Simulator path/);
assert.match(guide, /## Now versus later/);

const t262Manifest = spawnSync("git", ["show", "b29809d57dafbddf589e96202aad20e070f48c86:config/s2-t262-dice-technical-registry-v1.json"], { encoding: null });
assert.equal(t262Manifest.status, 0, "documented T262 registry must exist in shared Git objects");
const parsedRegistry = JSON.parse(t262Manifest.stdout.toString("utf8"));
assert.equal(parsedRegistry.fixtures.length, 80);
assert.equal(parsedRegistry.fixtures.filter((item) => item.language === "en").length, 40);
assert.equal(parsedRegistry.fixtures.filter((item) => item.language === "zh-Hant").length, 40);
assert.equal(parsedRegistry.registry_payload_sha256, "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030");
assert.equal(createHash("sha256").update(t262Manifest.stdout).digest("hex").length, 64);

console.log("S2-T269 Founder Dice window source contract passed");
