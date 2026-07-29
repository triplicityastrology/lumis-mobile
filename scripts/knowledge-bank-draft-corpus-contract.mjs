import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = readFileSync(
  "packages/astrology/src/knowledge-bank-draft-regression-corpus.fixtures.ts",
  "utf8"
);
const doc = readFileSync(
  "docs/architecture/S2-T30-knowledge-bank-draft-intake-regression-corpus.md",
  "utf8"
);

for (const tag of ["natal_core", "natal_deep", "timing_future"]) {
  assert.match(fixture, new RegExp(`"${tag}"`));
}
for (const coverage of [
  "duplicate record ID",
  "duplicate scope key",
  "malformed language",
  "malformed capability",
  "missing metadata",
  "scope contamination",
  "Dice",
  "Solar Return",
  "transit",
  "timing execution",
  "Vertex",
  "annual theme",
  "generated interpretation",
  "provider credential",
  "record email",
]) {
  assert.match(fixture, new RegExp(coverage, "i"));
}
assert.match(doc, /Status: development-only, inactive/);
assert.match(doc, /first\s+development draft/);
assert.match(doc, /Authored draft fields are never emitted/);
assert.match(doc, /no workbook mutation/i);
assert.doesNotMatch(
  fixture,
  /fetch\(|supabase|openai|anthropic|process\.env|apiKey|secret|react-native|expo-/
);

console.log("inactive Knowledge Bank draft corpus contract passed");
