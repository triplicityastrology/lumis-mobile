import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const entry = readFileSync("apps/mobile/index.ts", "utf8");
const screen = readFileSync("apps/mobile/src/dev/PersonaComparisonWorkbench.tsx", "utf8");
const fixture = readFileSync("apps/mobile/src/dev/personaComparisonFixture.ts", "utf8");
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const launcher = readFileSync("scripts/start-persona-comparison-expo.sh", "utf8");

assert.match(entry, /__DEV__\s*&&\s*process\.env\.EXPO_PUBLIC_PERSONA_COMPARISON_WORKBENCH === "1"/);
assert.match(entry, /:\s*createElement\(App\)/);
assert.match(app, /import PersonaComparisonWorkbench from "\.\/src\/dev\/PersonaComparisonWorkbench"/);
assert.match(app, /founderTestsAvailable && founderTestRoute === "persona"/);
assert.doesNotMatch(app, /screen === "personaComparison"|setScreen\("personaComparison"\)/);
assert.match(`${screen}\n${fixture}`, /Local evidence fixture only\. This is not a live AI response\./);
assert.match(screen, /accessibilityRole="tab"/);
assert.match(fixture, /Acceptance.*Spark.*Awareness/s);
assert.doesNotMatch(`${screen}\n${fixture}`, /fetch\s*\(|createClient|supabase|AsyncStorage|SecureStore|openai|anthropic|azure/i);
assert.match(launcher, /EXPO_PUBLIC_PERSONA_COMPARISON_WORKBENCH=1/);
assert.match(launcher, /--tunnel/);
assert.match(launcher, /--clear/);
assert.doesNotMatch(launcher, /kill\s|pkill|killall/);

console.log("development persona comparison workbench contract passed");
