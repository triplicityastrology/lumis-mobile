import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const boundary = read("apps/mobile/src/dev/founderDiceE2eContract.ts");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const web = read("scripts/start-s2-t264-founder-dice-web.sh");
const simulator = read("scripts/start-s2-t264-founder-dice-simulator.sh");
const manifest = JSON.parse(read("config/s2-t264-founder-dice-e2e-manifest.json"));
const guide = read("docs/qa/S2-T264-founder-dice-e2e.md");

assert.match(boundary, /T257_DICE_GATEWAY_INTERFACE = "dice_synthetic_gateway_port_v1"/);
assert.match(boundary, /ACCEPTED_FOUNDER_DICE_ENVELOPE_SHA256: string \| null = null/);
assert.match(boundary, /Readonly<\{ fixture_id: string \}>/);
assert.match(boundary, /STOP_S2_T264_GATEWAY_DISABLED/);
assert.match(boundary, /member_auth: 0; persistence_writes: 0; units_charged: 0/);
assert.doesNotMatch(boundary, /supabase\/functions|dice-synthetic-gateway-port-v1\.ts|fetch\s*\(|createClient|AsyncStorage|SecureStore/);
assert.doesNotMatch(`${boundary}\n${consoleSource}`, /s2-t262|s2-t263/i);

for (const marker of ["Freeze selected slot", "External validation + classification", "Eligibility and invoke seam", "Invoke eligible fixture ID", "Prepare checksum package"]) {
  assert.match(consoleSource, new RegExp(marker.replace(/[+]/g, "\\+")));
}
assert.match(consoleSource, /useWindowDimensions/);
assert.match(consoleSource, /fontScale >= 1\.2/);
assert.match(consoleSource, /maxFontSizeMultiplier = 1\.4/);
assert.match(consoleSource, /maxFontSizeMultiplier=\{1\.4\}/);
assert.match(consoleSource, /accessibilityState=\{\{ disabled: true \}\}/);
assert.doesNotMatch(consoleSource, /Past Rolls|history/i);
assert.doesNotMatch(consoleSource, /fetch\s*\(|createClient\s*\(|supabase\.from|AsyncStorage|SecureStore|AZURE_|member[_-]?auth/i);

assert.match(web, /FOUNDER_DICE_WEB_PORT:-8141/);
assert.match(web, /EXPECTED_BRANCH="codex\/s2-t264-founder-dice-e2e"/);
assert.match(web, /expo export --platform web --dev --clear/);
assert.match(web, /python3 -m http\.server 8141 --bind 127\.0\.0\.1/);
assert.match(simulator, /FOUNDER_DICE_SIMULATOR_PORT:-8144/);
assert.match(simulator, /expo start --ios --clear --port/);
assert.doesNotMatch(`${web}\n${simulator}`, /pnpm install|npm install|kill\s|pkill|killall/);

assert.equal(manifest.schema, "s2_t264_founder_dice_e2e_manifest_v1");
assert.equal(manifest.base_commit, "9f36ca6386fd421de409e73d8399c88737909033");
assert.deepEqual(manifest.source_contracts, ["S2-T257"]);
assert.equal(manifest.web.port, 8141);
assert.equal(manifest.simulator.port, 8144);
assert.deepEqual(manifest.default_states, ["not_yet_run", "offline_preview"]);
assert.equal(manifest.live_synthetic.accepted_envelope_checked_in, false);
assert.deepEqual(manifest.effects, { member_auth: 0, normal_routes: 0, persistence_writes: 0, units_charged: 0 });
assert.ok(manifest.failure_codes.every((code) => code.startsWith("STOP_S2_T264_")));
assert.equal(manifest.rollback.command, "git revert <S2-T264-commit>");
assert.match(guide, /## Now versus accepted live/);
assert.match(guide, /## Exact steps/);
assert.match(guide, /## Failure map/);
assert.match(guide, /## Rollback/);

for (const [path, expected] of Object.entries(manifest.t257_documented_contract.sha256)) {
  const shown = spawnSync("git", ["show", `${manifest.t257_documented_contract.commit}:${path}`], { encoding: null });
  assert.equal(shown.status, 0, `documented T257 artifact must exist: ${path}`);
  assert.equal(createHash("sha256").update(shown.stdout).digest("hex"), expected, `documented T257 artifact checksum: ${path}`);
}

console.log("S2-T264 Founder Dice E2E source/manifest contract passed");
