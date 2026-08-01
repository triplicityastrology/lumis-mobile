import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = readFileSync(
  "supabase/functions/_shared/fixed-template-registry.ts",
  "utf8"
);
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const chat = readFileSync("apps/mobile/src/services/chat.ts", "utf8");
const architecture = readFileSync(
  "docs/architecture/S2-T47-fixed-template-runtime-boundary.md",
  "utf8"
);

assert.match(registry, /ai_routing_fixed_template_wording_v0\.2/);
for (const id of [
  "ROUTER_UNAVAILABLE",
  "ROUTE_UNAVAILABLE",
  "OUT_OF_SCOPE",
  "OUT_OF_SCOPE_SOLAR_RETURN",
  "PROFESSIONAL_BOUNDARY",
  "PROFESSIONAL_REFLECTIVE_DISCLAIMER",
  "CRISIS_IMMINENT",
  "DISTRESS_SAFETY_CHECK",
  "ILLEGAL_BOUNDARY",
]) {
  assert.match(registry, new RegExp(`${id}_EN`));
  assert.match(registry, new RegExp(`${id}_ZH_HANT`));
}
assert.match(registry, /FIXED_TEMPLATE_CLINICAL_REVIEW_REQUIRED/);
assert.match(registry, /FIXED_TEMPLATE_PRODUCTION_WORDING_REQUIRED/);
assert.match(registry, /languageFallbackApplied/);
assert.match(registry, /generated: false/);
assert.doesNotMatch(registry, /fetch\s*\(|createClient|Deno\.env|getenv|openai|azure|anthropic|translate/i);
assert.doesNotMatch(`${app}\n${chat}`, /fixed-template-registry/);
assert.match(architecture, /server-side only/i);
assert.match(architecture, /no mobile caller/i);
assert.match(architecture, /clinical review/i);
assert.match(architecture, /provisional staging\/development baseline/i);

console.log("fixed-template runtime boundary contract passed");
