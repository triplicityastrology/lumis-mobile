import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/_shared/dice-interpretation-v1.ts", "utf8");
assert.match(source, /DICE_INTERPRETATION_ENABLED = false/);
assert.match(source, /dice_only_no_chart_persona_or_knowledge_bank/);
assert.match(source, /DICE_INTERPRETATION_FIXED_TEMPLATE_REQUIRED/);
assert.match(source, /PROFESSIONAL_REFLECTIVE_DISCLAIMER_/);
assert.doesNotMatch(source, /fetch\s*\(|Deno\.env|createClient\s*\(|OpenAI|Azure/i);
assert.doesNotMatch(source, /console\.(log|error|warn)/);
for (const forbidden of ["chartContext", "birthData", "persona", "history", "provider", "routingAuthority", "credentials"]) {
  assert.match(fs.readFileSync("supabase/functions/_shared/dice-interpretation-v1.fixtures.ts", "utf8"), new RegExp(`"${forbidden}"`));
}
console.log("S2-T176 server-only Dice interpretation contract passed.");
