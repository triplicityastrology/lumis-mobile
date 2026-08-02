import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const screen = read("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx");
const product = read("apps/mobile/src/features/careCircle/CareCircleScreen.tsx");
const rehearsal = read("apps/mobile/src/dev/CareCircleLocalRehearsal.tsx");
const liveGate = read("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingSessionGate.tsx");
const live = read("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx");
const recovery = read("apps/mobile/test-workbenches/care-circle-staging/workbenchRecovery.ts");
const deviceSafety = read("apps/mobile/test-workbenches/care-circle-staging/workbenchDeviceSafety.ts");
const deviceFixtures = read("apps/mobile/test-workbenches/care-circle-staging/workbenchDeviceSafety.fixtures.ts");
const manifest = JSON.parse(read("docs/qa/S2-T142-care-circle-device-state-manifest.json"));
const visualChecklist = JSON.parse(read("docs/qa/S2-T169-care-circle-visual-difference-checklist.json"));

assert.match(product, /75ee368 -> 9e31edc -> 467a3f9 -> db26a54/);
assert.match(product, /export function CareCircleProductFrame/);
assert.match(product, /productBackground/);
assert.match(product, /<CelestialBackground variant="care" \/>/);
assert.match(product, /export function CareCircleScannerFrame/);
assert.match(screen, /CareCircleProductFrame/);
assert.match(screen, /CareCirclePairingCodeMark/);
assert.match(screen, /CareCircleScannerFrame/);
assert.match(screen, /productBackground/);
assert.match(screen, /showPreviewBadge=\{false\}/);
assert.match(rehearsal, /<CareCircleStagingWorkbench/);
assert.match(live, /<CareCircleStagingWorkbench/);

for (const rejected of [
  "Local rehearsal — not live backend",
  "Synthetic Caree",
  "Synthetic Carer",
  "FOUNDER TEST GUIDE",
  "Reset guide",
  "PREVIEW / NOT ACTIVE",
  "STAGING TEST WORKBENCH",
]) {
  assert.doesNotMatch(`${screen}\n${rehearsal}\n${liveGate}`, new RegExp(rejected));
}
assert.doesNotMatch(screen, /CareCircleFounderGuidance|founderGuidance/);
assert.match(rehearsal, /onBack=\{\(\) => setTestPanelVisible\(true\)\}/);
assert.match(liveGate, /onOpenTestControls/);
assert.doesNotMatch(rehearsal, /LOCAL TEST|testPill|position: "absolute"/);
assert.doesNotMatch(liveGate, /FOUNDER TEST ·|testPill/);
assert.equal((screen.match(/<ScrollView/g) ?? []).length, 1);
assert.match(screen, /useWindowDimensions/);
assert.match(screen, /Keyboard\.addListener\("keyboardDidShow"/);
assert.match(screen, /resolveCareCircleProductLayout/);
assert.match(screen, /returnKeyType="done"/);
assert.match(deviceSafety, /width < 400 \|\| fontScale >= 1\.35/);
assert.match(deviceSafety, /input\.keyboardVisible \|\| height < 720/);
assert.match(deviceFixtures, /iphone_393x852/);
assert.match(deviceFixtures, /iphone_430x932/);
assert.match(deviceFixtures, /large_text/);
assert.match(deviceFixtures, /keyboard_visible/);
assert.match(deviceFixtures, /short_height/);
assert.match(deviceFixtures, /productStates\.length, 13/);

for (const productCopy of [
  "YOUR CHECK-INS",
  "PEOPLE YOU CARE FOR",
  "Show my check-in code",
  "Scan or enter someone's code",
  "My check-in code",
  "Pending Caree acceptance · no authority",
]) {
  assert.ok(screen.includes(productCopy), `missing product copy: ${productCopy}`);
}
assert.match(screen, /Pairing code copied/);
assert.match(screen, /keyboardType="number-pad"/);
assert.match(screen, /maxLength=\{4\}/);
assert.match(screen, /label: "Accept"/);
assert.doesNotMatch(screen, /Test sixth rejection|LUMIS123|Simulate scan/u);
assert.match(screen, /label: "Decline"/);
assert.match(screen, /active: "Active · accepted by Caree"/);
assert.match(screen, /paused \? "Resume" : "Pause"/);
assert.match(screen, /label: "Leave"/);
assert.match(recovery, /invalid, expired, or revoked/);
assert.match(screen, /backgroundColor: "rgba\(58,80,118,0\.30\)"/);
assert.match(screen, /safe: \{ flex: 1, backgroundColor: "transparent" \}/);
assert.doesNotMatch(screen, /Reusable pairing code ready for this ten-minute staging window|Backend response received|Participant-safe staging|Refresh status/);
assert.match(screen, /borderRadius: 18/);
assert.match(screen, /height: 48/);

assert.equal(manifest.release_activation, "inactive");
assert.equal(manifest.native_capture.web_substitution_used, false);
assert.equal(manifest.native_capture.status, "blocked");
assert.deepEqual(manifest.reference_images, [
  "/Users/rubyku/Downloads/IMG_9418.PNG",
  "/Users/rubyku/Downloads/IMG_9417.PNG",
]);
assert.deepEqual(manifest.recovered_lineage, ["75ee368", "9e31edc", "467a3f9", "db26a54", "3d8c7a4"]);
assert.equal(visualChecklist.schema, "s2_t169_care_circle_visual_difference_v1");
assert.equal(visualChecklist.checks.length, 8);
assert.equal(visualChecklist.native_retest_required, true);
assert.equal(visualChecklist.automated_similarity_claim, false);
assert.deepEqual(visualChecklist.returned_device_captures, [
  "/Users/rubyku/Downloads/IMG_9420.PNG",
  "/Users/rubyku/Downloads/IMG_9421.PNG",
]);
assert.deepEqual(manifest.states.map(({ name }) => name), [
  "caree_landing", "four_digit_code_ready", "copy_confirmation", "carer_entry",
  "pending_no_authority", "caree_accept_decline", "active", "paused", "resumed",
  "carer_self_removal", "removed_cleanup", "expired_code", "generic_invalid_code",
]);
console.log("S2-T142 recovered product presentation contract passed; native capture blocker remains explicit.");
