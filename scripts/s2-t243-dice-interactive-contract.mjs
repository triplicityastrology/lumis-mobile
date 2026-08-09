import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rejectDuplicateCaptures, validateCaptureReceipt, validateSessionReceipt } from "./lib/s2-t243-dice-capture-receipts.mjs";

const read = (file) => readFileSync(file, "utf8");
const ritual = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const history = read("apps/mobile/src/features/dice/DiceHistorySheet.tsx");
const gallery = read("apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx");
const fixtures = read("apps/mobile/src/dev/diceInterpretationFixture.ts");
const index = read("apps/mobile/index.ts");
const browser = read("scripts/start-s2-t243-dice-gallery.sh");
const capture = read("scripts/s2-t243-dice-native-capture.sh");
const control = JSON.parse(read("supabase/tests/s2-t243-dice-capture-control.json"));

assert.match(index, /__DEV__ && process\.env\.EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY === "1"/);
assert.match(ritual, /if \(developmentNoPersistence\)[\s\S]{0,120}setSaveError\(false\)[\s\S]{0,80}return/);
assert.doesNotMatch(history, /developmentNoPersistence/, "history sheet must not carry a Founder-mode escape hatch");
assert.match(ritual, /!developmentNoPersistence \? \([\s\S]{0,180}accessibilityLabel="Past rolls"/, "Founder mode must hide Past Rolls");
assert.match(ritual, /if \(!developmentNoPersistence\) \{[\s\S]{0,260}sessionRollsRef\.current =/, "Founder mode must not collect session rolls");
assert.match(ritual, /!developmentNoPersistence && historyOpen \? \([\s\S]{0,160}<DiceHistorySheet/, "Founder mode must not instantiate history");
assert.match(ritual, /classifyDiceQuestionRequest/);
assert.match(ritual, /developmentBuildInterpretation/);
assert.match(ritual, /diceQuestionStopMessage/);
assert.match(ritual, /Preparing your interpretation/);
assert.match(gallery, /CelestialBackground/);
assert.match(gallery, /zero provider · zero units · zero persistence/);
assert.match(gallery, /dice-zero-effects-boundary/);
assert.match(gallery, /BUILD \{buildMarker\}/);
assert.match(gallery, /STATE \{(?:fixture\.id|captureState)\}/);
assert.match(gallery, /allowFontScaling=\{false\}/);
assert.match(fixtures, /id: "invalid_hi"[\s\S]{0,180}question: "hi"/);
for (const id of ["bundled", "safety", "disallowed", "interactive_en", "interactive_zh", "loading", "judgment_en", "descriptive_zh", "content_filter", "fallback", "malformed", "timeout_unavailable", "retry", "idempotent_replay", "concurrent_duplicate"]) {
  assert.match(fixtures, new RegExp(`id: "${id}"`));
}
assert.doesNotMatch(gallery, /fetch\s*\(|createClient|saveDiceThrow|consumeUnits/);
assert.doesNotMatch(fixtures, /providerCalls: [1-9]|persistenceWrites: [1-9]|unitsConsumed: [1-9]/);
assert.match(browser, /expo export --dev --platform web --clear/);
assert.match(browser, /GALLERY_MARKER_MISSING|NORMAL_AUTH_FALLBACK|EXPORTED_BUILD_MARKER_MISMATCH/);
assert.match(capture, /VISIBLE_BUILD_OR_STATE_MARKER_MISSING|DUPLICATE_STATE_CAPTURE|send magic link/);
assert.match(capture, /packager-status:running/);
assert.match(capture, /simctl openurl "\$DEVICE" "\$ROUTE"/);
assert.doesNotMatch(browser + capture, /(?:^|\n)\s*kill\s|pnpm install|npm install/);
assert.equal(control.states.length, 16);
assert.equal(new Set(control.states).size, 16);

const source = "a".repeat(40);
const session = { schema: "s2_t243_dice_capture_session_v1", source_sha: source, build_marker: source, route_prefix: control.route_prefix, port: 8117, device_udid: control.device_udid, session_nonce: "b".repeat(64), created_at: "2026-08-09T10:00:00Z" };
validateSessionReceipt(session, control, source);
const bytes = Buffer.from("synthetic-image-a");
const receipt = { schema: "s2_t243_dice_capture_receipt_v1", source_sha: source, build_marker: source, session_nonce: session.session_nonce, device_udid: control.device_udid, state: control.states[0], route: `${control.route_prefix}?state=${control.states[0]}`, visible_fixture_label: `STATE ${control.states[0]}`, file: `captures/${control.states[0]}.png`, image_sha256: "2da1f03954ab3bef294319b5bb0a67aaaf953648d33d2b416403facb861dad0f", width: control.expected_dimensions.width, height: control.expected_dimensions.height, captured_at: "2026-08-09T10:01:00Z", live_ai_proof: false, units_consumed: 0, persistence_writes: 0 };
validateCaptureReceipt(receipt, { control, session, sourceSha: source, imageBytes: bytes, width: receipt.width, height: receipt.height });
for (const mutate of [
  (x) => { x.state = "stale_auth"; },
  (x) => { x.route = "normal-auth"; },
  (x) => { x.visible_fixture_label = "STATE judgment_en"; },
  (x) => { x.source_sha = "c".repeat(40); },
  (x) => { x.persistence_writes = 1; },
  (x) => { x.extra = "unknown"; },
]) assert.throws(() => validateCaptureReceipt((() => { const x = structuredClone(receipt); mutate(x); return x; })(), { control, session, sourceSha: source, imageBytes: bytes, width: receipt.width, height: receipt.height }));
assert.throws(() => rejectDuplicateCaptures([receipt, { ...receipt }]));
console.log("S2-T243 interactive offline Dice contracts passed.");
