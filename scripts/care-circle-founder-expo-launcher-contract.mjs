import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [packageSource, launcher, boundary, founderScreen] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("scripts/start-care-circle-founder-expo.sh", "utf8"),
  readFile(
    "apps/mobile/test-workbenches/care-circle-staging/stagingWorkbenchBoundary.ts",
    "utf8",
  ),
  readFile("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx", "utf8"),
]);
const packageJson = JSON.parse(packageSource);

assert.equal(
  packageJson.scripts["start:care-circle-founder"],
  "bash scripts/start-care-circle-founder-expo.sh",
);
assert.match(launcher, /lumis-mobile-s1t04-work/);
assert.match(launcher, /bmqhwofmdgebpcihjlnb/);
assert.match(launcher, /https:\/\/bmqhwofmdgebpcihjlnb\.supabase\.co/);
assert.match(launcher, /care-circle-founder-receipt\.json/);
assert.match(launcher, /s2-care-circle-founder-receipt\.mjs --validate/);
assert.doesNotMatch(launcher, /S2_CARE_CIRCLE_HEALTH_GATE/);
assert.doesNotMatch(launcher, /S2_CARE_CIRCLE_DEPLOYED_SHA256/);
assert.match(launcher, /function_sha256/);
assert.match(launcher, /status --porcelain --untracked-files=no/);
assert.match(launcher, /LUMIS_CURRENT_BUILD commit=%s branch=%s app=normal/);
assert.match(launcher, /lsof -tiTCP:/);
assert.match(launcher, /PORT_OWNED_BY_ANOTHER_PROJECT/);
assert.match(launcher, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1/);
assert.match(launcher, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY=1/);
assert.match(launcher, /exec pnpm --dir "\$MOBILE_DIR" exec expo start --tunnel --port "\$PORT" --clear/);
assert.doesNotMatch(launcher, /test-workbenches\/care-circle-staging.*expo start/);
assert.doesNotMatch(launcher, /\bkill\b|SUPABASE_SERVICE_ROLE_KEY/);
assert.match(launcher, /\/sb_secret_\|service_role\|sbp_\/i\.test\(key\)/);
assert.doesNotMatch(launcher, /export (SUPABASE_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY)/);
assert.doesNotMatch(launcher, /printf[^\n]*(SUPABASE_KEY|PUBLIC_KEY)/);
assert.doesNotMatch(launcher, /printf[^\n]*(RECEIPT_METADATA|FUNCTION_VERSION|FUNCTION_SHA)/);
assert.match(boundary, /input\.deploymentReady !== "1"/);
assert.match(boundary, /CARE_CIRCLE_WORKBENCH_DEPLOYMENT_NOT_READY/);
assert.match(founderScreen, /Care Circle test is not ready/);
assert.match(founderScreen, /No staging operation was attempted/);

console.log("S2-T105 normal-app Care Circle founder launcher contract passed.");
