import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const boundary = read("apps/mobile/src/dev/founderDiceWindowContract.ts");
const fixtures = read("apps/mobile/src/dev/founderDiceWindowContract.fixtures.ts");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const web = read("scripts/start-s2-t280-founder-dice-web.sh");
const simulator = read("scripts/start-s2-t280-founder-dice-simulator.sh");
const guide = read("docs/qa/S2-T280-founder-dice-window-final.md");
const manifest = JSON.parse(read("config/s2-t280-founder-dice-window-manifest.json"));

assert.match(boundary, /T272_RUNTIME_COMMIT = "f5f9e9da238633d84eb8695307c573eef8f1bc96"/);
assert.match(boundary, /T274_LEDGER_PROOF_RECEIPT_SHA256 = "4b10620285c08a16688bfa5f8dd85912ce6a4ee6d7cff13c8a17f2ce13da2f9e"/);
assert.match(boundary, /RUNTIME_ACCEPTANCE_SCHEMA = "s2_t280_dice_runtime_package_acceptance_v1"/);
assert.match(boundary, /TECHNICAL_EVIDENCE_SCHEMA = "s2_t280_dice_technical_evidence_acceptance_v1"/);
assert.match(boundary, /FOUNDER_WINDOW_RECEIPT_SCHEMA = "s2_t280_founder_window_authorization_receipt_v1"/);
assert.match(boundary, /ACCEPTED_RUNTIME_ENVELOPE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_TECHNICAL_EVIDENCE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256: string \| null = null/);
assert.match(boundary, /logical_total: 80/);
assert.match(boundary, /founder_cases: 0/);
assert.match(boundary, /fixture_total: 40/);
assert.match(boundary, /en: 20; "zh-Hant": 20/);
assert.match(boundary, /invocation_shape: "fixture_id_only"/);
assert.match(boundary, /DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY/);
assert.match(boundary, /provider_calls_after_close: 0/);
assert.match(boundary, /STOP_S2_T280_RUNTIME_NOT_ACCEPTED/);
assert.match(boundary, /STOP_S2_T280_TECHNICAL_EVIDENCE_NOT_ACCEPTED/);
assert.match(boundary, /STOP_S2_T280_FOUNDER_RECEIPT_NOT_ACCEPTED/);
assert.match(boundary, /STOP_S2_T280_EXECUTION_NOT_ACCEPTED/);
assert.doesNotMatch(boundary, /T262_PACKAGE|T267|fetch\s*\(|createClient\s*\(|supabase\.from|AsyncStorage|SecureStore|AZURE_|LUMIS_AI_ENABLED/i);
assert.doesNotMatch(boundary, /question\s*:/, "runtime invocation contains no question text");

for (const marker of ["Final runtime package gate", "Technical evidence gate", "Prepare Founder questions", "Founder-window request", "Verify selected fixture result", "Close and disable"]) assert.match(consoleSource, new RegExp(marker));
assert.match(consoleSource, /Complete all 40 slots first/);
assert.match(consoleSource, /20 EN \/ 20 zh-Hant/);
assert.match(consoleSource, /WAITING FOR ACCEPTED FINAL RUNTIME PACKAGE/);
assert.match(consoleSource, /WAITING FOR SEPARATELY ACCEPTED FOUNDER WINDOW RECEIPT/);
assert.match(consoleSource, /accessibilityLiveRegion="polite"/);
assert.match(consoleSource, /useWindowDimensions/);
assert.match(consoleSource, /fontScale >= 1\.2/);
assert.doesNotMatch(`${boundary}\n${consoleSource}`, /fetch\s*\(|createClient\s*\(|supabase\.from|DiceHistorySheet|Past Rolls|sessionRollsRef/i);
assert.doesNotMatch(boundary, /raw_provider_response|raw_prompt|raw_response/);

for (const hostile of ["migration_0039_in_scope: true", "founder_cases: 1", "raw_response: \"forbidden\"", "invocation_shape: \"question_text\"", "raw_provider_response: \"forbidden\"", "provider_calls_after_close: 1"]) assert.match(fixtures, new RegExp(hostile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.match(web, /FOUNDER_DICE_WINDOW_WEB_PORT:-8147/);
assert.match(web, /EXPECTED_BRANCH="codex\/s2-t280-founder-dice-window-final"/);
assert.match(web, /expo export --platform web --dev --clear/);
assert.match(web, /python3 -m http\.server 8147 --bind 127\.0\.0\.1/);
assert.match(web, /Final runtime package gate/);
assert.match(simulator, /FOUNDER_DICE_WINDOW_SIMULATOR_PORT:-8148/);
assert.match(simulator, /expo start --ios --clear --port/);
assert.match(simulator, /simctl terminate "\$DEVICE" host\.exp\.Exponent/);
assert.doesNotMatch(simulator, /simctl terminate booted|simctl shutdown|bootstatus/);
assert.doesNotMatch(`${web}\n${simulator}`, /kill\s|pkill|killall|pnpm install|npm install/);

assert.equal(manifest.base_commit, "e85c150678483620c1bbd0cc534210401f364ebf");
assert.equal(manifest.completed_authority.t272_runtime_commit, "f5f9e9da238633d84eb8695307c573eef8f1bc96");
assert.equal(manifest.completed_authority.t274_ledger_proof_receipt_sha256, "4b10620285c08a16688bfa5f8dd85912ce6a4ee6d7cff13c8a17f2ce13da2f9e");
assert.deepEqual(manifest.founder_window.language_counts, { en: 20, "zh-Hant": 20 });
assert.deepEqual(manifest.stable_interfaces.runtime_request_fields, ["fixture_id"]);
assert.equal(manifest.founder_window.accepted_runtime_envelope_checked_in, false);
assert.equal(manifest.founder_window.accepted_technical_evidence_checked_in, false);
assert.equal(manifest.founder_window.accepted_founder_authorization_checked_in, false);
assert.deepEqual(manifest.effects, { provider_calls: 0, member_data: 0, history_reads: 0, persistence_writes: 0, units_charged: 0 });
assert.equal(manifest.web.port, 8147);
assert.equal(manifest.simulator.port, 8148);
assert.equal(manifest.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.match(guide, /## Founder browser path/);
assert.match(guide, /## Simulator path/);
assert.match(guide, /## Now versus later/);

for (const path of [
  "config/s2-t280-runtime-package-acceptance.schema.json",
  "config/s2-t280-technical-evidence-acceptance.schema.json",
  "config/s2-t280-founder-window-authorization-receipt.schema.json",
  "config/s2-t280-founder-execution-evidence.schema.json",
]) {
  const schema = JSON.parse(read(path));
  assert.equal(schema.additionalProperties, false, `${path} must be closed`);
}

const runtimeEvidence = spawnSync("git", ["show", "f5f9e9da238633d84eb8695307c573eef8f1bc96:config/evidence/s2-t272-dice-runtime-proof.json"], { encoding: null });
assert.equal(runtimeEvidence.status, 0, "completed T272 runtime proof must exist in shared Git objects");
assert.equal(createHash("sha256").update(runtimeEvidence.stdout).digest("hex"), manifest.completed_authority.t272_runtime_proof_sha256);
assert.equal(spawnSync("git", ["cat-file", "-e", "1433a4168ab57a4e8b5f010a022e7cfe91f691dc^{commit}"]).status, 0, "completed T275/T279 interface authority must exist");

console.log("S2-T280 final Founder Dice window source contract passed");
