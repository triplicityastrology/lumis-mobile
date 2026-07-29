import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doc = readFileSync(
  "docs/qa/S2-T22-natal-engine-regression-corpus.md",
  "utf8"
);
const fixture = readFileSync(
  "packages/astrology/src/natal-regression-corpus.fixtures.ts",
  "utf8"
);

assert.match(doc, /Status: inactive, pure, deterministic technical infrastructure/);
assert.match(
  doc,
  /provider_neutral_natal_v1[\s\S]*natal_engine_input_v1[\s\S]*natal_engine_output_v1[\s\S]*natal_context_v1/
);
for (const requirement of [
  "Conjunction 8 degrees",
  "sextile 4 degrees",
  "square 8 degrees",
  "trine 8 degrees",
  "opposition 8 degrees",
  "quincunx 2 degrees",
  "just inside",
  "just outside",
  "Circular geometry",
  "Canonical aliases",
  "Duplicate aliases",
  "Timed chart",
  "No-birth-time chart",
  "Chiron",
  "North Node",
  "South Node",
  "Solar Return",
  "transit",
  "timing",
  "Vertex",
  "annual theme",
  "Dice contamination",
  "byte-identical",
  "Privacy",
]) {
  assert.match(doc, new RegExp(requirement, "i"));
}
assert.match(fixture, /NATAL_ASPECT_RULES/);
assert.match(fixture, /adaptProviderNeutralNatalPayload/);
assert.match(fixture, /composeNatalEngineOutput/);
assert.match(fixture, /projectSafeNatalContext/);
assert.match(fixture, /EPSILON = 0\.0001/);
assert.match(fixture, /repeated lifecycle output is byte-stable/);
assert.doesNotMatch(
  `${doc}\n${fixture}`,
  /fetch\(|supabase|openai|anthropic|astrology-api|process\.env|EXPO_PUBLIC/i
);

console.log("inactive natal regression corpus contract passed");
