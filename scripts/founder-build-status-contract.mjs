import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const panel = readFileSync("apps/mobile/src/dev/FounderBuildStatusPanel.tsx", "utf8");
const launcher = readFileSync("scripts/start-normal-expo.sh", "utf8");
assert.match(app, /founderTestsAvailable && founderTestRoute === "buildStatus"/);
assert.match(panel, /EXPO_PUBLIC_LUMIS_SOURCE_COMMIT/);
assert.match(panel, /Reload Current Bundle/);
assert.match(panel, /DevSettings\.reload\(\)/);
assert.match(panel, /Bundle inclusion does not claim/);
assert.match(launcher, /export EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="\$COMMIT"/);
assert.doesNotMatch(`${panel}\n${launcher}`, /SUPABASE_URL|SUPABASE_KEY|password|secret/i);
console.log("Founder build status contract passed.");
