import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertCompleteUniqueCaptures, sha256, validateCaptureReceipt, validateSessionReceipt } from "./lib/s2-t246-dice-exact-receipts.mjs";

const read = (file) => readFileSync(file, "utf8");
const control = JSON.parse(read("config/s2-t246-dice-exact-evidence.json"));
const fixtures = read("apps/mobile/src/dev/diceInterpretationFixture.ts");
const workbench = read("apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx");
const ritual = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const history = read("apps/mobile/src/features/dice/DiceHistorySheet.tsx");
const native = read("scripts/s2-t246-dice-native-capture.sh");
const browser = read("scripts/start-s2-t246-dice-gallery.sh");

assert.equal(control.states.length, 13);
assert.equal(new Set(control.states.map(({ id }) => id)).size, 13);
assert.equal(new Set(control.states.map(({ fixture }) => fixture)).size, 13);
for (const { id, fixture, visible_evidence: evidence } of control.states) {
  assert.match(fixtures, new RegExp(`${id}: "${fixture}"`));
  assert.ok(evidence.length >= 4);
}
assert.match(fixtures, /id: "invalid_hi"[\s\S]{0,260}question: "hi"[\s\S]{0,260}Make this one clear question/);
assert.match(fixtures, /id: "judgment_en"[\s\S]{0,520}reading:/);
assert.match(fixtures, /id: "descriptive_zh"[\s\S]{0,520}reading:/);
assert.match(workbench, /getDiceExactCaptureFixture/);
assert.match(workbench, /STATE \{captureState\}/);
assert.match(workbench, /BUILD \{buildMarker\}/);
assert.match(workbench, /developmentNoPersistence/);
assert.match(workbench, /developmentPreSubmitBoundary/);
assert.doesNotMatch(workbench, /fetch\s*\(|createClient|saveDiceThrow|consumeUnits/);
assert.match(ritual, /if \(developmentNoPersistence\)[\s\S]{0,160}setSaveError\(false\)[\s\S]{0,100}return/);
assert.doesNotMatch(history, /developmentNoPersistence/, "history sheet must be unreachable rather than instantiated in Founder mode");
assert.match(ritual, /!developmentNoPersistence \? \([\s\S]{0,180}accessibilityLabel="Past rolls"/);
assert.match(ritual, /if \(!developmentNoPersistence\) \{[\s\S]{0,260}sessionRollsRef\.current =/);
assert.match(ritual, /!developmentNoPersistence && historyOpen \? \([\s\S]{0,160}<DiceHistorySheet/);
assert.match(native, /s2-t246-ocr-validate\.mjs/);
assert.match(native, /s2-t246-dice-session\.mjs validate/);
assert.match(native, /DUPLICATE_STATE_CAPTURE|VISIBLE_EXACT_STATE_NOT_PROVEN|METRO_BUILD_MARKER_MISSING/);
assert.match(browser, /expo export --dev --platform web --clear/);
assert.doesNotMatch(native + browser, /(?:^|\n)\s*kill\s|pnpm install|npm install|curl\s+https:/);

const source = "a".repeat(40);
const session = {
  schema: "s2_t246_dice_capture_session_v1",
  session_id: "c".repeat(64),
  source_sha: source,
  metro_bundle_sha256: "b".repeat(64),
  route_prefix: control.route_prefix,
  port: control.simulator_port,
  device_udid: control.device_udid,
  created_at: "2026-08-09T10:00:00.000Z",
  expected_states: control.states.map(({ id }) => id)
};
validateSessionReceipt(session, control, source);
const imageBytes = Buffer.from("synthetic-png-for-contract");
const ocrText = `STATE ${control.states[0].id}\nBUILD ${source}\n${control.states[0].visible_evidence}`;
const receipt = {
  schema: "s2_t246_dice_capture_receipt_v1",
  session_id: session.session_id,
  source_sha: source,
  metro_bundle_sha256: session.metro_bundle_sha256,
  state: control.states[0].id,
  fixture: control.states[0].fixture,
  route: `${control.route_prefix}?state=${control.states[0].id}`,
  file: `captures/${control.states[0].id}.png`,
  image_sha256: sha256(imageBytes),
  ocr_sha256: sha256(ocrText),
  width: control.expected_dimensions.width,
  height: control.expected_dimensions.height,
  captured_at: "2026-08-09T10:01:00.000Z",
  build_marker_verified: true,
  state_marker_verified: true,
  product_evidence_verified: true,
  forbidden_frame_detected: false,
  ...control.effects,
  live_ai_proof: false,
  human_verdict: "pending"
};
const context = { control, session, imageBytes, ocrText, width: receipt.width, height: receipt.height };
validateCaptureReceipt(receipt, context);
for (const mutate of [
  (value) => { value.source_sha = "d".repeat(40); },
  (value) => { value.metro_bundle_sha256 = "e".repeat(64); },
  (value) => { value.state = control.states[1].id; },
  (value) => { value.fixture = control.states[1].fixture; },
  (value) => { value.image_sha256 = "f".repeat(64); },
  (value) => { value.width = 1; },
  (value) => { value.forbidden_frame_detected = true; },
  (value) => { value.provider_calls = 1; },
  (value) => { value.remote_history_reads = 1; },
  (value) => { value.extra = "not allowed"; }
]) {
  const changed = structuredClone(receipt);
  mutate(changed);
  assert.throws(() => validateCaptureReceipt(changed, context));
}
const complete = control.states.map(({ id, fixture }, index) => ({ ...receipt, state: id, fixture, route: `${control.route_prefix}?state=${id}`, file: `captures/${id}.png`, image_sha256: index.toString(16).padStart(64, "0") }));
assertCompleteUniqueCaptures(complete, control);
assert.throws(() => assertCompleteUniqueCaptures(complete.slice(1), control));
assert.throws(() => assertCompleteUniqueCaptures(complete.map((item) => ({ ...item, image_sha256: "0".repeat(64) })), control));
console.log("S2-T246 Dice exact-state evidence contracts passed.");
