import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const screen = read("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx");
const product = read("apps/mobile/src/features/careCircle/CareCircleScreen.tsx");
const rehearsal = read("apps/mobile/src/dev/CareCircleLocalRehearsal.tsx");
const liveGate = read("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingSessionGate.tsx");
const live = read("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx");
const recovery = read("apps/mobile/test-workbenches/care-circle-staging/workbenchRecovery.ts");
const manifest = JSON.parse(read("docs/qa/S2-T142-care-circle-device-state-manifest.json"));

assert.match(product, /before 3d8c7a4/);
assert.match(product, /export function CareCircleProductFrame/);
assert.match(product, /productBackground/);
assert.match(product, /#0B3340/);
assert.match(screen, /CareCircleProductFrame/);
assert.match(screen, /CareCirclePairingCodeMark/);
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
assert.match(rehearsal, /Open local Care Circle test controls/);
assert.match(liveGate, /Open staging Care Circle test controls/);
assert.match(rehearsal, /position: "absolute"/);
assert.match(liveGate, /position: "absolute"/);
assert.equal((screen.match(/<ScrollView/g) ?? []).length, 1);

for (const productCopy of [
  "YOUR CHECK-INS (YOU ARE THE CAREE)",
  "PEOPLE YOU CARE FOR (YOU ARE THE CARER)",
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
assert.match(screen, /label: atCapacity \? "Test sixth rejection" : "Accept"/);
assert.match(screen, /label: "Decline"/);
assert.match(screen, /active: "Active · accepted by Caree"/);
assert.match(screen, /paused \? "Resume" : "Pause"/);
assert.match(screen, /label: "Leave"/);
assert.match(recovery, /invalid, expired, or revoked/);

assert.equal(manifest.release_activation, "inactive");
assert.equal(manifest.native_capture.web_substitution_used, false);
assert.equal(manifest.native_capture.status, "blocked");
assert.deepEqual(manifest.states.map(({ name }) => name), [
  "caree_landing", "four_digit_code_ready", "copy_confirmation", "carer_entry",
  "pending_no_authority", "caree_accept_decline", "active", "paused", "resumed",
  "carer_self_removal", "removed_cleanup", "expired_code", "generic_invalid_code",
]);
console.log("S2-T142 recovered product presentation contract passed; native capture blocker remains explicit.");
