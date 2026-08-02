import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const kit = readFileSync("apps/mobile/src/components/AuthSystemKit.tsx", "utf8");
const policy = readFileSync("apps/mobile/src/services/startupRestorePolicy.ts", "utf8");
const founderGate = readFileSync("apps/mobile/src/services/founderTestVisibility.ts", "utf8");
assert.match(app, /loadStartupAuthStatus\(\)[\s\S]*restoreAccountForStatus\(status, true, true\)/);
assert.match(app, /shouldRetryStartupAuthStatus\(status, retryCount\)/);
assert.match(app, /shouldRetryStartupAccountError\(error, retryCount\)/);
assert.match(app, /accountRestoreFreshnessRef\.current\.begin\(\)/);
assert.match(app, /if \(!restoreTicket\.isCurrent\(\)\) return/);
assert.doesNotMatch(policy, /ACCOUNT_DATA_INCOMPLETE/);
assert.doesNotMatch(policy, /ACCOUNT_AUTH_REQUIRED/);
assert.match(policy, /ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE/);
assert.match(kit, /Restoring your space/);
assert.match(kit, /result === "failed"/);
assert.match(kit, /Back to account/);
assert.doesNotMatch(kit, /Generating your chart/);
assert.match(app, /const founderTestsAvailable = canShowFounderTests/);
assert.match(app, /founderTestsAvailable && founderTestRoute === null/);
assert.match(app, /if \(!founderTestsAvailable && founderTestRoute !== null\)/);
assert.doesNotMatch(app, /__DEV__ && founderTestRoute === null/);
assert.match(founderGate, /accountLoadStatus === "loaded"/);
assert.match(founderGate, /!input\.modalOpen/);
for (const hiddenScreen of ["splash", "restoringSpace", "auth", "profile", "preview", "birthDetails", "chartUpdated", "noChart"]) {
  assert.doesNotMatch(founderGate.match(/STABLE_ACCOUNT_SCREENS[\s\S]*?\]\);/)?.[0] ?? "", new RegExp(`"${hiddenScreen}"`));
}
console.log("cold-start restoration race contract passed");
