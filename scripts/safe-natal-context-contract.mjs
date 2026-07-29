import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const projector = readFileSync(
  "packages/astrology/src/safe-natal-context.ts",
  "utf8"
);
const architecture = readFileSync(
  "docs/architecture/deterministic-natal-fact-engine.md",
  "utf8"
);

assert.match(projector, /NATAL_CONTEXT_VERSION = "natal_context_v1"/);
assert.match(projector, /NATAL_ENGINE_OUTPUT_VERSION/);
assert.match(projector, /engineOutput\.scope !== "natal"/);
assert.match(projector, /validated_deterministic_natal_engine_output/);
assert.match(projector, /"chiron"/);
assert.match(projector, /"north_node"/);
assert.match(projector, /"south_node"/);
assert.match(projector, /\.sort\(compareCanonicalKey\)/);
assert.match(projector, /NATAL_CONTEXT_UNKNOWN_FIELD/);
assert.doesNotMatch(
  projector,
  /fetch\(|Deno\.env|process\.env|createClient|supabase|astrology-api|openai|azure|anthropic|console\./i
);
assert.doesNotMatch(
  projector,
  /apps\/mobile|from ["'][^"']*dice|chat-message|knowledge bank|insert\(|update\(|upsert\(|rpc\(|deploy|migration/i
);
assert.match(architecture, /Safe natal context projector/);
assert.match(architecture, /inactive technical infrastructure/);
assert.match(architecture, /Chiron and the North and\s+South Nodes/);
assert.match(architecture, /not imported by Dice/);

console.log("safe natal context projector source contracts passed");
