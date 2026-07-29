import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "packages/shared/src/config/app-language-state-machine.ts",
  "utf8"
);
const fixtures = readFileSync(
  "packages/shared/src/config/app-language-state-machine.fixtures.ts",
  "utf8"
);
const doc = readFileSync(
  "docs/architecture/S2-T24-pure-app-language-preference-state-machine.md",
  "utf8"
);

assert.match(doc, /Status: inactive, pure TypeScript infrastructure/);
assert.match(source, /APP_LANGUAGE_STATE_MACHINE_VERSION/);
assert.match(source, /"first_launch_required"/);
assert.match(source, /"loading_saved_preference"/);
assert.match(source, /"saving_preference"/);
assert.match(source, /"save_failed"/);
assert.match(source, /"offline"/);
assert.match(source, /"migration_unavailable"/);
assert.match(source, /accountBoundary: previous\.accountBoundary/);
assert.match(source, /state\.savedPreference \?\? detectRequestLanguage\(requestText\)/);
assert.match(source, /role: "radio"/);
assert.match(fixtures, /preserves valid account\/chart\/onboarding state/);
assert.match(fixtures, /offline failure preserves saved authority/);
assert.match(fixtures, /missing migration is not a saved state/);
assert.match(fixtures, /saved preference wins over Chinese request/);
assert.match(fixtures, /same input creates byte-stable state/);
assert.doesNotMatch(
  `${source}\n${fixtures}`,
  /fetch\(|supabase|AsyncStorage|process\.env|expo-|react-native|openai|anthropic|dice/i
);
assert.doesNotMatch(
  doc,
  /selector screen implemented|migration deployed|preference persisted successfully/i
);

console.log("inactive app-language state-machine contract passed");
