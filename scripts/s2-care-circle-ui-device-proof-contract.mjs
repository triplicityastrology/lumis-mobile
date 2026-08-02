import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screen = readFileSync("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx", "utf8");
const product = readFileSync("apps/mobile/src/features/careCircle/CareCircleScreen.tsx", "utf8");
const rehearsal = readFileSync("apps/mobile/src/dev/CareCircleLocalRehearsal.tsx", "utf8");
const live = readFileSync("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx", "utf8");
const recovery = readFileSync("apps/mobile/test-workbenches/care-circle-staging/workbenchRecovery.ts", "utf8");
const manifest = JSON.parse(readFileSync("docs/qa/S2-T142-care-circle-device-state-manifest.json", "utf8"));

assert.match(product, /before 3d8c7a4/);
assert.match(product, /export function CareCircleProductFrame/);
assert.match(screen, /CareCircleProductFrame/);
assert.match(screen, /CareCirclePairingCodeMark/);
assert.match(screen, /CareCircleFounderGuidance/);
assert.match(rehearsal, /<CareCircleStagingWorkbench/);
assert.match(live, /<CareCircleStagingWorkbench/);
assert.doesNotMatch(screen, /STAGING TEST WORKBENCH|STAGING PAIRING CODE/);
assert.match(screen, /FOUNDER TEST · DISPOSABLE ACCOUNTS/);
assert.match(screen, /LOCAL REHEARSAL · NOT LIVE/);
assert.match(screen, /PAIRING CODE/);
assert.match(screen, /Pairing code copied/);
assert.match(screen, /keyboardType="number-pad"/);
assert.match(screen, /maxLength=\{4\}/);
assert.match(screen, /Pending Caree acceptance · no authority/);
assert.match(screen, /label: atCapacity \? "Test sixth rejection" : "Accept"/);
assert.match(screen, /label: "Decline"/);
assert.match(screen, /active: "Active · accepted by Caree"/);
assert.match(screen, /paused \? "Resume Care Circle" : "Pause Care Circle"/);
assert.match(screen, /label: "Remove myself"/);
assert.match(rehearsal, /Confirm synthetic cleanup/);
assert.match(recovery, /invalid, expired, or revoked/);
assert.equal(manifest.release_activation, "inactive");
assert.equal(manifest.native_capture.web_substitution_used, false);
assert.deepEqual(manifest.states.map(({ name }) => name), [
  "caree_landing", "four_digit_code_ready", "copy_confirmation", "carer_entry",
  "pending_no_authority", "caree_accept_decline", "active", "paused", "resumed",
  "carer_self_removal", "removed_cleanup", "expired_code", "generic_invalid_code",
]);
console.log("S2-T142 recovered Care Circle product-state contract passed; native capture limitation is explicit.");
