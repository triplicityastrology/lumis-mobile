import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/_shared/persona-prompt-pipeline-v1.ts", "utf8");
const app = readFileSync("apps/mobile/App.tsx", "utf8");

assert.match(source, /enabled:\s*false/u);
assert.match(source, /authority:\s*"trusted_server_config"/u);
assert.match(source, /calculatePersonaProfile/u);
assert.match(source, /assemblePersonaBehaviorPromptFromCalculation/u);
assert.match(source, /PERSONA_PROMPT_PIPELINE_INACTIVE/u);
assert.match(source, /customer_chart_unavailable/u);
assert.match(source, /sourceRulesApplied:\s*_runtimeProvenance/u);
assert.doesNotMatch(source, /fetch\s*\(|createClient|Deno\.env|console\.|openai|azure|anthropic|provider/iu);
assert.doesNotMatch(app, /persona-prompt-pipeline-v1/u);

console.log("inactive server-only Persona prompt pipeline contract passed");
