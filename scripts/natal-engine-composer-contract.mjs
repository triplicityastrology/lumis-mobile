import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const composer = readFileSync(
  "packages/astrology/src/natal-engine-composer.ts",
  "utf8"
);
const architecture = readFileSync(
  "docs/architecture/deterministic-natal-fact-engine.md",
  "utf8"
);

assert.match(composer, /NATAL_ENGINE_OUTPUT_VERSION = "natal_engine_output_v1"/);
assert.match(composer, /validateNatalEngineInput\(input\)/);
assert.match(composer, /if \(!validated\.ok\) \{\s+return validated;/);
assert.match(composer, /deriveMoonSignFromLocalDayEndpoints/);
assert.match(composer, /deriveTraditionalChartRuler/);
assert.match(composer, /deriveTraditionalHouseRuler/);
assert.match(composer, /deriveNatalAspects/);
assert.match(composer, /scope: "natal"/);
assert.match(composer, /\.sort\(compareCanonicalFacts\)/);
assert.doesNotMatch(
  composer,
  /fetch\(|Deno\.env|process\.env|createClient|supabase|astrology-api|openai|azure|anthropic/i
);
assert.doesNotMatch(
  composer,
  /apps\/mobile|dice|chat-message|knowledge bank|insert\(|update\(|upsert\(|rpc\(|deploy|migration/i
);
assert.match(architecture, /Deterministic natal engine composer/);
assert.match(architecture, /not exposed to users/);
assert.match(
  architecture,
  /no Knowledge Bank retrieval, interpretation, Chat or AI context,\s+provider request, persistence/
);

console.log("deterministic natal engine composer source contracts passed");
