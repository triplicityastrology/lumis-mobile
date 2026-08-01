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
const recovery = read(`${root}/workbenchRecovery.ts`);
const recoveryFixture = read(`${root}/workbenchRecovery.fixtures.ts`);
const deviceSafety = read(`${root}/workbenchDeviceSafety.ts`);
const deviceSafetyFixture = read(`${root}/workbenchDeviceSafety.fixtures.ts`);
const outcomeIntegrity = read(`${root}/workbenchOutcomeIntegrity.ts`);
const outcomeFixture = read(`${root}/workbenchOutcomeIntegrity.fixtures.ts`);
const entry = read(`${root}/index.tsx`);
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
assert.match(sessionGate, /Authenticated disposable staging session/);
assert.match(screen, /capabilities\.canActAsCaree/);
assert.match(screen, /capabilities\.canActAsCarer/);
assert.match(outcomeIntegrity, /Pending Caree acceptance confirmed/);
assert.match(screen, /Pending Caree acceptance · no authority/);
assert.match(screen, /Accepted Carers · \$\{accepted\.length\}\/5/);
assert.match(screen, /atCapacity = accepted\.length >= 5/);
assert.match(screen, /Test sixth rejection/);
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
assert.match(screen, /Care Circle test progress/);
assert.match(screen, /Evidence state:/);
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
assert.match(screen, /setPairingCodeInput\(""\)/);
assert.match(screen, /setPairingCode\(null\)/);
assert.match(screen, /My Caree relationships/);
assert.match(screen, /Remove myself/);
assert.match(screen, /const projection = await refreshRelationships\(false\)/);
assert.match(portFixture, /CARE_CIRCLE_SIGN_IN_FAILED/);
assert.match(portFixture, /email is not echoed/);
assert.match(portFixture, /password is not echoed/);
assert.match(metro, /workspaceRoot/);
assert.match(metro, /path\.resolve\(workspaceRoot, "node_modules"\)/);

for (const releaseSource of [
  releaseEntry,
  releaseApp,
  releasePreview,
]) {
  assert.doesNotMatch(
    releaseSource,
    /CareCircleStagingWorkbench|stagingWorkbenchBoundary|test-workbenches/
  );
}

const releaseTree = listSourceFiles("apps/mobile/src")
  .map(read)
  .join("\n");
assert.doesNotMatch(
  releaseTree,
  /CareCircleStagingWorkbench|stagingWorkbenchBoundary/
);
assert.doesNotMatch(
  `${screen}\n${sessionGate}\n${port}\n${entry}`,
  /console\.|AsyncStorage|SecureStore|analytics|capture|track\(|Camera|BarCode|Notifications|scheduleNotification|billing|payment|emergency/i
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
