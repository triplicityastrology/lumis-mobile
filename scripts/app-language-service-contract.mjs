import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "apps/mobile/src/services/appLanguagePreference.ts",
  "utf8"
);
const fixtures = readFileSync(
  "apps/mobile/src/services/appLanguagePreference.fixtures.ts",
  "utf8"
);
const doc = readFileSync(
  "docs/architecture/S2-T26-inactive-app-language-preference-service.md",
  "utf8"
);

assert.match(doc, /Status: pure, mocked, inactive service boundary/);
assert.match(source, /APP_LANGUAGE_PREFERENCE_SERVICE_VERSION/);
for (const code of [
  "LANGUAGE_PREFERENCE_SAVED",
  "LANGUAGE_PREFERENCE_INVALID",
  "LANGUAGE_PREFERENCE_OFFLINE",
  "LANGUAGE_PREFERENCE_AUTH_REQUIRED",
  "LANGUAGE_PREFERENCE_MIGRATION_UNAVAILABLE",
  "LANGUAGE_PREFERENCE_SAVE_FAILED",
]) {
  assert.match(source, new RegExp(code));
}
assert.match(source, /isAppLanguagePreference\(input\)/);
assert.match(source, /result\.language !== input/);
assert.match(fixtures, /service construction performs no automatic write/);
assert.match(fixtures, /cannot reset account, chart, Persona, focus, reflections, or onboarding/);
assert.match(doc, /server-owned Chat preference remains\s+authoritative/);
assert.doesNotMatch(
  source,
  /createClient|getSupabaseClient|from\("|rpc\("|fetch\(|AsyncStorage|navigation|chat|openai|anthropic|process\.env|dice/i
);

console.log("inactive app-language preference service contract passed");
