import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mapping = readFileSync("supabase/functions/_shared/persona-behavior-mapping-v1.ts", "utf8");
const assembler = readFileSync("supabase/functions/_shared/persona-behavior-v1.ts", "utf8");
const app = readFileSync("apps/mobile/App.tsx", "utf8");

assert.equal((mapping.match(/"mappingId":/g) ?? []).length, 60);
assert.match(assembler, /safety.*emotional_state.*immutable_role.*calculated_profile.*behavior_mapping.*conflict_resolution.*language/s);
assert.match(assembler, /PERSONA_BEHAVIOR_INPUT_INVALID/);
assert.match(assembler, /customer_chart_unavailable/);
assert.match(assembler, /spark_moon_from_customer_sun_trine/);
assert.doesNotMatch(assembler, /neutral_emotional_attunement|stable_boundary/);
assert.match(assembler, /do not mention internal calculations or mapping IDs/i);
assert.doesNotMatch(`${mapping}\n${assembler}`, /fetch\s*\(|createClient|Deno\.env|console\.|openai|azure|anthropic|provider/i);
assert.doesNotMatch(app, /persona-behavior-v1|persona-behavior-mapping-v1/);

console.log("server-only persona behavior registry contract passed");
