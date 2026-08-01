import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const hub = readFileSync("apps/mobile/src/dev/FounderTestHub.tsx", "utf8");
const comparison = readFileSync("apps/mobile/src/dev/PersonaComparisonWorkbench.tsx", "utf8");

assert.match(app, /__DEV__ && founderTestRoute === "hub"/);
assert.match(app, /__DEV__ && founderTestRoute === "persona"/);
assert.match(app, /__DEV__ && founderTestRoute === null/);
assert.match(hub, /Local fixture, not live AI/);
assert.match(hub, /Acceptance · Spark · Awareness/);
assert.match(hub, /onOpenPersonaComparison/);
assert.match(comparison, /Back to Founder Test Hub/);
assert.match(comparison, /onExit/);
assert.doesNotMatch(`${hub}\n${comparison}`, /fetch\s*\(|createClient|supabase|AsyncStorage|SecureStore|openai|anthropic|azure/i);

console.log("normal-Expo Founder Test Hub contract passed");
