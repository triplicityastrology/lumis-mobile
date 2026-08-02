import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const hub = readFileSync("apps/mobile/src/dev/FounderTestHub.tsx", "utf8");
const comparison = readFileSync("apps/mobile/src/dev/PersonaComparisonWorkbench.tsx", "utf8");
const careCircle = readFileSync("apps/mobile/src/dev/FounderCareCircleWorkbench.tsx", "utf8");

assert.match(app, /__DEV__ && founderTestRoute === "hub"/);
assert.match(app, /__DEV__ && founderTestRoute === "buildStatus"/);
assert.match(app, /__DEV__ && founderTestRoute === "persona"/);
assert.match(app, /__DEV__ && founderTestRoute === "careCircle"/);
assert.match(app, /__DEV__ && founderTestRoute === "reflectionDeletion"/);
assert.match(app, /__DEV__ && founderTestRoute === null/);
assert.match(hub, /Local fixture, not live AI/);
assert.match(hub, /Acceptance · Spark · Awareness/);
assert.match(hub, /onOpenPersonaComparison/);
assert.match(hub, /onOpenCareCircle/);
assert.match(hub, /onOpenBuildStatus/);
assert.match(hub, /Current build and feature status/);
assert.match(hub, /Local rehearsal available/);
assert.match(hub, /Past Reflections deletion test/);
assert.match(comparison, /Back to Founder Test Hub/);
assert.match(comparison, /onExit/);
assert.doesNotMatch(`${hub}\n${comparison}`, /fetch\s*\(|createClient|supabase|AsyncStorage|SecureStore|openai|anthropic|azure/i);
assert.match(careCircle, /resolveFounderCareCircleEntryBoundary/);
assert.match(careCircle, /EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY/);
assert.match(careCircle, /No staging operation was attempted/);
assert.match(careCircle, /const supabase = getSupabaseClient\(\)/);
assert.match(careCircle, /createStagingWorkbenchPorts\(supabase\)/);
assert.match(careCircle, /CareCircleLocalRehearsal/);
assert.match(careCircle, /Open local rehearsal/);

console.log("normal-Expo Founder Test Hub contract passed");
