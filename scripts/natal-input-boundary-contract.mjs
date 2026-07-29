import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const boundary = readFileSync(
  "packages/astrology/src/natal-input-boundary.ts",
  "utf8"
);
const architecture = readFileSync(
  "docs/architecture/deterministic-natal-fact-engine.md",
  "utf8"
);

assert.match(boundary, /NATAL_INPUT_CONTRACT_VERSION = "natal_engine_input_v1"/);
assert.match(boundary, /const ROOT_FIELDS = new Set\(\[[\s\S]*"schemaVersion"[\s\S]*"chartType"[\s\S]*"precision"[\s\S]*"points"[\s\S]*"houses"/);
assert.match(boundary, /NATAL_INPUT_UNKNOWN_FIELD/);
assert.match(boundary, /NATAL_INPUT_OUT_OF_SCOPE/);
assert.match(boundary, /NATAL_INPUT_DUPLICATE_POINT/);
assert.match(boundary, /NATAL_INPUT_TIME_CAPABILITY_MISMATCH/);
assert.match(boundary, /solarreturn[\s\S]*annualtheme[\s\S]*transit[\s\S]*timing[\s\S]*vertex/);
assert.match(boundary, /canonicalizeNatalPointKey/);
assert.match(boundary, /normalizeNatalLongitude/);
assert.match(boundary, /resolveBirthTimeCapabilities/);
assert.match(boundary, /validated_provider_normalised_natal_input/);
assert.doesNotMatch(
  boundary,
  /fetch\(|Deno\.env|process\.env|createClient|supabase|astrology-api|openai|azure|anthropic/i
);
assert.doesNotMatch(boundary, /apps\/mobile|dice|chat-message|knowledge bank/i);
assert.doesNotMatch(boundary, /insert\(|update\(|upsert\(|rpc\(|deploy|migration/i);
assert.match(architecture, /Provider-normalised natal input boundary/);
assert.match(
  architecture,
  /not wired to a provider, persistence,\s+mobile UI, Chat, AI retrieval, or Dice/,
);

console.log("provider-normalised natal input source contracts passed");
