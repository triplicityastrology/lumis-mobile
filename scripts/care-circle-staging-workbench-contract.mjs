import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");
const root =
  "apps/mobile/test-workbenches/care-circle-staging";
const boundary = read(`${root}/stagingWorkbenchBoundary.ts`);
const fixture = read(`${root}/stagingWorkbenchBoundary.fixtures.ts`);
const screen = read(`${root}/CareCircleStagingWorkbench.tsx`);
const sessionGate = read(`${root}/CareCircleStagingSessionGate.tsx`);
const port = read(`${root}/stagingWorkbenchPort.ts`);
const portFixture = read(`${root}/stagingWorkbenchPort.fixtures.ts`);
const progress = read(`${root}/workbenchProgress.ts`);
const progressFixture = read(`${root}/workbenchProgress.fixtures.ts`);
const singlePhoneJourney = read(`${root}/singlePhoneJourney.ts`);
const singlePhoneJourneyFixture = read(`${root}/singlePhoneJourney.fixtures.ts`);
const recovery = read(`${root}/workbenchRecovery.ts`);
const recoveryFixture = read(`${root}/workbenchRecovery.fixtures.ts`);
const deviceSafety = read(`${root}/workbenchDeviceSafety.ts`);
const deviceSafetyFixture = read(`${root}/workbenchDeviceSafety.fixtures.ts`);
const outcomeIntegrity = read(`${root}/workbenchOutcomeIntegrity.ts`);
const outcomeFixture = read(`${root}/workbenchOutcomeIntegrity.fixtures.ts`);
const evidenceSummary = read(`${root}/workbenchEvidenceSummary.ts`);
const evidenceSummaryFixture = read(`${root}/workbenchEvidenceSummary.fixtures.ts`);
const localRehearsal = read(`${root}/localCareCircleRehearsal.ts`);
const localRehearsalScreen = read("apps/mobile/src/dev/CareCircleLocalRehearsal.tsx");
const entry = read(`${root}/index.tsx`);
const founderEntry = read("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx");
const metro = read(`${root}/metro.config.js`);
const workbenchPackage = JSON.parse(read(`${root}/package.json`));
const releasePackage = JSON.parse(read("apps/mobile/package.json"));
const releaseEntry = read("apps/mobile/index.ts");
const releaseApp = read("apps/mobile/App.tsx");
const releasePreview = read(
  "apps/mobile/src/features/careCircle/CareCircleScreen.tsx"
);
const doc = read("docs/qa/S2-T35-care-circle-staging-test-workbench.md");

assert.equal(workbenchPackage.main, "index.tsx");
assert.equal(releasePackage.main, "index.ts");
assert.match(boundary, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH/);
assert.match(boundary, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY/);
assert.match(boundary, /resolveFounderCareCircleEntryBoundary/);
assert.match(fixture, /CARE_CIRCLE_WORKBENCH_DEPLOYMENT_NOT_READY/);
assert.match(boundary, /input\.flag !== "1"/);
assert.match(boundary, /!input\.isDevelopment/);
assert.match(boundary, /bmqhwofmdgebpcihjlnb/);
assert.match(fixture, /default is disabled/);
assert.match(fixture, /production mode is disabled/);
assert.match(fixture, /unknown project is disabled/);
assert.match(fixture, /explicit staging development build is enabled/);

for (const operation of [
  "create_pairing_code",
  "rotate_pairing_code",
  "submit_pairing_code",
  "accept_relationship",
  "decline_relationship",
  "pause_care",
  "resume_care",
  "remove_relationship",
]) {
  assert.match(screen, new RegExp(`"${operation}"`));
}
assert.match(entry, /createInactiveCareCircleClient\(ports\.operationPort\)/);
assert.match(entry, /supabaseUrl: process\.env\.EXPO_PUBLIC_SUPABASE_URL/);
assert.match(boundary, /CARE_CIRCLE_STAGING_SUPABASE_ORIGIN/);
assert.match(boundary, /parsed\.protocol === "https:"/);
assert.match(boundary, /parsed\.hostname ===/);
assert.match(boundary, /parsed\.pathname === "\/"/);
assert.match(fixture, /staging ref with a non-staging URL is disabled/);
assert.match(fixture, /malformed, non-HTTPS, or non-origin URL is disabled/);
assert.match(entry, /CareCircleStagingSessionGate/);
assert.match(entry, /sessionPort=\{ports\.sessionPort\}/);
assert.match(port, /list_care_relationships/);
assert.match(port, /resolve_care_circle_capability/);
assert.match(port, /signInWithPassword/);
assert.match(port, /auth\.signOut/);
assert.match(sessionGate, /Disposable account sign-in/);
assert.match(sessionGate, /secureTextEntry/);
assert.match(sessionGate, /setPassword\(""\)/);
assert.match(sessionGate, /key=\{sessionEpoch\}/);
assert.match(sessionGate, /advanceSinglePhoneJourney/);
assert.match(sessionGate, /Current: \{flow\.journey\.label\}/);
assert.match(sessionGate, /flow\.journey\.nextLabel/);
assert.match(sessionGate, /onOpenTestControls/);
assert.match(singlePhoneJourney, /confirmationSource/);
assert.match(singlePhoneJourney, /input\.confirmationSource !== current\.requiredConfirmation/);
assert.match(sessionGate, /Preview Test Summary/);
assert.match(sessionGate, /selectable style=\{styles\.summaryText\}/);
assert.match(evidenceSummary, /lumis_care_circle_test_summary_v1/);
assert.match(evidenceSummary, /build_marker/);
assert.doesNotMatch(evidenceSummary, /timestamp|email|user_id|pairing_code|url|raw_error/i);
assert.doesNotMatch(sessionGate, /Clipboard|setStringAsync/);
assert.match(sessionGate, /Reset Evidence/);
assert.match(sessionGate, /recordConfirmedWorkbenchEvidence/);
assert.doesNotMatch(sessionGate, /Clipboard|setStringAsync|Share\.share/);
for (const evidenceName of [
  "code_ready",
  "code_copied",
  "pending_no_authority",
  "accepted_active",
  "paused",
  "resumed",
  "self_removed",
  "relationship_cleanup",
]) {
  assert.match(evidenceSummary, new RegExp(`"${evidenceName}"`));
}
assert.match(evidenceSummaryFixture, /request-ready state is not evidence/);
assert.match(evidenceSummaryFixture, /summary items expose safe fields only/);
assert.match(screen, /capabilities\.accountRole/);
assert.match(localRehearsalScreen, /onBack=\{\(\) => setTestPanelVisible\(true\)\}/);
assert.match(localRehearsalScreen, /Local rehearsal only\. No live backend or staging evidence\./);
assert.match(localRehearsalScreen, /item === "caree" \? "Use Caree" : "Use Carer"/);
assert.match(localRehearsalScreen, /Confirm cleanup/);
assert.match(localRehearsalScreen, /Start over/);
assert.doesNotMatch(localRehearsalScreen, /LOCAL TEST|testPill/);
assert.doesNotMatch(sessionGate, /FOUNDER TEST ·|testPill/);
assert.doesNotMatch(
  localRehearsal,
  /supabase|fetch\s*\(|AsyncStorage|SecureStore|functions\.invoke|https?:\/\//i
);
assert.match(port, /account_mode/);
assert.match(portFixture, /backend account mode fixes the test identity/);
for (const step of [
  "caree_create_code",
  "carer_submit_code",
  "caree_accept",
  "carer_verify_active",
  "caree_pause",
  "caree_resume",
  "carer_remove",
  "operator_cleanup_required",
]) {
  assert.match(singlePhoneJourney, new RegExp(`"${step}"`));
}
assert.match(singlePhoneJourney, /counts are zero/);
assert.match(singlePhoneJourneyFixture, /wrong identity cannot advance/);
assert.doesNotMatch(sessionGate, /FOUNDER TEST ·/);
assert.match(screen, /capabilities\.canActAsCaree/);
assert.match(screen, /capabilities\.canActAsCarer/);
assert.match(outcomeIntegrity, /Pending Caree acceptance confirmed/);
assert.match(screen, /Pending Caree acceptance · no authority/);
assert.match(screen, /Up to 5 accepted Carers/);
assert.match(screen, /atCapacity = accepted\.length >= 5/);
assert.match(screen, /label: "Accept"/);
assert.doesNotMatch(screen, /Test sixth rejection/);
assert.match(outcomeIntegrity, /Backend capacity rejection confirmed/);
for (const evidenceState of [
  "signed_out",
  "caree_code_ready",
  "carer_pending_no_authority",
  "caree_decision_required",
  "active",
  "paused",
  "removed",
  "relationship_cleanup_complete",
]) {
  assert.match(progress, new RegExp(`"${evidenceState}"`));
}
assert.match(progress, /Pending Caree acceptance/);
assert.match(progress, /no Care Circle authority/);
assert.match(progressFixture, /pending is not active/);
assert.doesNotMatch(screen, /CareCircleFounderGuidance|FOUNDER TEST GUIDE|Reset guide/);
assert.match(sessionGate, /signedOutProgress/);
assert.match(sessionGate, /Care Circle test progress/);
for (const safeFailureState of [
  "auth_check_unavailable",
  "auth_sign_in_failed",
  "pairing_code_unavailable",
  "pending_refresh_unavailable",
  "staging_function_unavailable",
]) {
  assert.match(recovery, new RegExp(`"${safeFailureState}"`));
}
assert.match(recovery, /invalid, expired, or revoked/);
assert.match(recovery, /No change was confirmed/);
assert.match(screen, /Retry refresh/);
assert.match(screen, /Retry request/);
assert.match(screen, /KeyboardAvoidingView/);
assert.match(sessionGate, /KeyboardAvoidingView/);
assert.match(screen, /contentInsetAdjustmentBehavior="never"/);
assert.match(sessionGate, /contentInsetAdjustmentBehavior="never"/);
assert.match(screen, /accessibilityState=\{\{ disabled/);
assert.match(deviceSafety, /fontScale >= 1\.35/);
assert.match(deviceSafety, /clear_transient_input/);
assert.match(deviceSafetyFixture, /double tap is rejected synchronously/);
assert.match(screen, /confirmWorkbenchOutcome/);
assert.match(screen, /result\.code === "CARE_CIRCLE_PAIRING_CODE_READY"\) return/);
assert.match(port, /readProjection/);
assert.match(port, /care_check_settings/);
assert.match(outcomeIntegrity, /outcome_unconfirmed/);
assert.match(outcomeFixture, /sent accept cannot imply active/);
assert.match(outcomeFixture, /sent removal cannot imply removed/);
assert.match(outcomeFixture, /generic conflict cannot imply capacity rejection/);
assert.match(screen, /type SafeRetryInput = Exclude/);
assert.match(screen, /input\.action !== "submit_pairing_code"/);
assert.doesNotMatch(screen, /text: result\.message/);
assert.match(sessionGate, /Retry session check/);
assert.match(recoveryFixture, /backend code is hidden/);
assert.match(recoveryFixture, /pairing material is hidden/);
assert.doesNotMatch(
  `${screen}\n${sessionGate}`,
  /error\.message|JSON\.stringify\(error|4800[4-9]|4801[0-3]/
);
assert.doesNotMatch(screen, /disabled: disabled \|\| atCapacity/);
assert.match(screen, /lifetime > 61 \* 60 \* 1000/);
assert.match(screen, /pairing code is ready until the shown expiry/);
assert.match(screen, /setPairingCodeInput\(""\)/);
assert.match(screen, /setPairingCode\(null\)/);
assert.match(screen, /PEOPLE YOU CARE FOR/);
assert.match(screen, /label: "Leave"/);
assert.match(screen, /const projection = await refreshRelationships\(false\)/);
assert.match(portFixture, /CARE_CIRCLE_SIGN_IN_FAILED/);
assert.match(portFixture, /email is not echoed/);
assert.match(portFixture, /password is not echoed/);
assert.match(metro, /workspaceRoot/);
assert.match(metro, /path\.resolve\(workspaceRoot, "node_modules"\)/);

for (const releaseSource of [releaseEntry, releasePreview]) {
  assert.doesNotMatch(
    releaseSource,
    /CareCircleStagingWorkbench|stagingWorkbenchBoundary|test-workbenches/
  );
}
assert.match(releaseApp, /founderTestsAvailable && founderTestRoute === "careCircle"/);
assert.match(releaseApp, /FounderCareCircleWorkbench/);
assert.match(founderEntry, /CareCircleStagingSessionGate/);
assert.match(founderEntry, /CareCircleStagingWorkbench/);
assert.match(founderEntry, /resolveFounderCareCircleEntryBoundary/);
assert.match(founderEntry, /createInactiveCareCircleClient\(ports\.operationPort\)/);
assert.match(founderEntry, /No staging operation was attempted/);
assert.match(releasePreview, /export function CareCircleProductFrame/);
assert.match(releasePreview, /export function CareCirclePairingCodeMark/);
assert.match(releasePreview, /before the export lock in 3d8c7a4/);
assert.match(screen, /CareCircleProductFrame/);
assert.match(screen, /CareCirclePairingCodeMark/);
assert.match(screen, /productBackground/);
assert.match(screen, /showPreviewBadge=\{false\}/);
assert.doesNotMatch(screen, /founderGuidance|PREVIEW · NOT ACTIVE|LOCAL REHEARSAL · NOT LIVE/);
assert.doesNotMatch(releasePreview, /export function CareCirclePrototypeScreen/);

const releaseTree = listSourceFiles("apps/mobile/src")
  .filter((path) => !path.startsWith("apps/mobile/src/dev/"))
  .map(read)
  .join("\n");
assert.doesNotMatch(
  releaseTree,
  /CareCircleStagingWorkbench|stagingWorkbenchBoundary/
);
assert.doesNotMatch(
  `${screen}\n${sessionGate}\n${port}\n${entry}`,
  /console\.|AsyncStorage|SecureStore|analytics|capture|track\(|Camera|BarCode|Notifications|scheduleNotification|billing|payment/i
);
assert.doesNotMatch(
  `${screen}\n${fixture}`,
  /["'][23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-?[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-?[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}["']/i
);
assert.match(doc, /Do not run until PM authorizes disposable staging validation/);
assert.match(doc, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1/);
assert.match(doc, /not a release feature/i);
assert.doesNotMatch(
  doc,
  /supabase (?:db push|functions deploy)|wrangler deploy|service_role\s*[:=]|sb_secret_/i
);

console.log("Care Circle staging workbench isolation contracts passed");

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}
