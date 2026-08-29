// Companion shared composition / routing contract.
//
// Proves the mobile normal-Chat surfaces share the ONE server-side composition/routing
// system and hold no independent prompt/composition or improvised fixed wording. It does
// NOT enable traffic, change routing/safety, or touch the sealed product-path candidate;
// it only verifies the current source. Run: `node scripts/companion-shared-composition-contract.mjs`.
//
// Scope of guarantees:
//  1. Single wording source: the app-boundary fixed-template mirrors in packages/shared are
//     byte-exact with the canonical server registry (fixed-template-registry.ts).
//  2. Legacy path canonicalised: the (disabled, orphaned) chat.ts + chat-message route select
//     every disposition from the shared canonical wording, with a DISTINCT professional_direct
//     outcome, and invent no reply text of their own.
//  3. No second composition: the single Prompt v3 assembler lives only in companion-synthesis-v1;
//     no mobile surface reimplements it or hard-codes Prompt v3 blocks, and the client never
//     imports the server persona pipeline / synthesis.
//  4. Authority unchanged: the product-path candidate keeps traffic OFF behind
//     NO_NORMAL_CHAT_INTEGRATION_AUTHORITY / NO_AZURE_TRAFFIC_AUTHORITY.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const registry = read("supabase/functions/_shared/fixed-template-registry.ts");
const sharedRouter = read("packages/shared/src/config/chat-router.ts");
const mobileChat = read("apps/mobile/src/services/chat.ts");
const chatEdge = read("supabase/functions/chat-message/index.ts");

// --- 1. Single wording source: packages/shared mirrors === server registry (byte-exact) ---

function registryText(templateId) {
  const match = registry.match(
    new RegExp(`templateId:\\s*"${templateId}",\\s*\\n\\s*text:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
  );
  assert.ok(match, `registry text not found for ${templateId}`);
  return match[1];
}

function sharedConst(name) {
  const match = sharedRouter.match(
    new RegExp(`export const ${name}\\s*=\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)";`)
  );
  assert.ok(match, `shared constant not found: ${name}`);
  return match[1];
}

const MIRRORED = [
  ["OUT_OF_SCOPE_EN", "OUT_OF_SCOPE_EN"],
  ["OUT_OF_SCOPE_ZH_HANT", "OUT_OF_SCOPE_ZH_HANT"],
  ["PROFESSIONAL_BOUNDARY_EN", "PROFESSIONAL_BOUNDARY_EN"],
  ["PROFESSIONAL_BOUNDARY_ZH_HANT", "PROFESSIONAL_BOUNDARY_ZH_HANT"],
  ["ROUTE_UNAVAILABLE_EN", "ROUTE_UNAVAILABLE_EN"],
  ["ROUTE_UNAVAILABLE_ZH_HANT", "ROUTE_UNAVAILABLE_ZH_HANT"],
];

for (const [constName, templateId] of MIRRORED) {
  assert.equal(
    sharedConst(constName),
    registryText(templateId),
    `app-boundary wording ${constName} drifted from the canonical registry ${templateId}`
  );
}

// The distinct professional refinement must be byte-identical to the reviewed server planner.
const planner = read("internal/companion-web-ai-lab/src/lab-engine.ts");
const plannerPattern = planner.match(/const PROFESSIONAL_DIRECT = (\/.*\/i);/);
const sharedPattern = sharedRouter.match(/const PROFESSIONAL_DIRECT_PATTERN\s*=\s*\n?\s*(\/.*\/i);/);
assert.ok(plannerPattern && sharedPattern, "professional_direct pattern must exist in both sources");
assert.equal(
  sharedPattern[1],
  plannerPattern[1],
  "shared professional_direct detector drifted from the reviewed Web Lab planner"
);

// --- 2. Legacy path canonicalised: shared wording only, distinct professional_direct ---

const BLENDED_DRIFT = /not replace medical, legal, financial/;
for (const [name, src] of [["chat.ts", mobileChat], ["chat-message/index.ts", chatEdge]]) {
  assert.doesNotMatch(src, BLENDED_DRIFT, `${name} still blends professional wording into out_of_scope`);
  assert.match(src, /isProfessionalDirectRequest\(/, `${name} must distinguish professional_direct`);
  assert.match(src, /getProfessionalBoundaryResponse\(/, `${name} must use the shared professional-boundary template`);
  assert.match(src, /getOutOfScopeResponse\(/, `${name} must use the shared out_of_scope template`);
  assert.match(src, /getRouteUnavailableResponse\(/, `${name} must surface the canonical route-unavailable template while disabled`);
  // No improvised Lumis reply composition may remain on these surfaces.
  assert.doesNotMatch(src, /I hear (this|the) question/, `${name} must not improvise a reply`);
  assert.doesNotMatch(src, /Treat these symbols as a reflective prompt/, `${name} must not improvise a dice reply`);
  assert.doesNotMatch(src, /connect it back to your pattern/, `${name} must not improvise a persona reply`);
}

// --- 3. No second composition system anywhere in mobile ---

// The single Prompt v3 assembler + block text exist ONLY in the shared canonical source.
const PROMPT_BLOCK_MARKERS = [
  "assembleCompanionPromptV3",
  "LUMIS CHARACTER EXPRESSION",
  "MEMBER COMMUNICATION AND COMFORT PROFILE",
];
const MOBILE_SURFACES = [
  "apps/mobile/src/services/chat.ts",
  "apps/mobile/src/services/chatProductIntegrationRc.ts",
  "apps/mobile/src/services/normalChatAiCandidate.ts",
  "apps/mobile/src/services/chatProductPathCandidate.ts",
  "supabase/functions/_shared/normal-chat-ai-candidate-v1.ts",
  "supabase/functions/chat-message/index.ts",
];
for (const path of MOBILE_SURFACES) {
  const src = read(path);
  for (const marker of PROMPT_BLOCK_MARKERS) {
    assert.ok(
      !src.includes(marker),
      `${path} must not reimplement shared composition (found "${marker}")`
    );
  }
}

// The client bundle must never import the server-only persona pipeline or synthesis assembler.
for (const path of ["apps/mobile/src/services/chat.ts", "apps/mobile/src/services/chatProductIntegrationRc.ts", "apps/mobile/src/services/normalChatAiCandidate.ts", "apps/mobile/App.tsx"]) {
  const src = read(path);
  assert.doesNotMatch(src, /persona-prompt-pipeline-v1/, `${path} must not import the server persona pipeline`);
  assert.doesNotMatch(src, /companion-synthesis-v1/, `${path} must not import the server synthesis assembler`);
}

// The canonical assembler is defined exactly once, in the shared source.
const synthesis = read("supabase/functions/_shared/companion-synthesis-v1.ts");
assert.match(synthesis, /export function assembleCompanionPromptV3\(/, "shared canonical assembler must exist");

// --- 4. Authority gates unchanged: product traffic stays OFF ---

const serverCandidate = read("supabase/functions/_shared/normal-chat-ai-candidate-v1.ts");
assert.match(serverCandidate, /NORMAL_CHAT_AI_INTEGRATION_ENABLED = false as const/, "product integration must stay disabled");
assert.match(serverCandidate, /NORMAL_CHAT_AI_TRAFFIC_ENABLED = false as const/, "product traffic must stay disabled");
assert.match(serverCandidate, /NO_NORMAL_CHAT_INTEGRATION_AUTHORITY/, "product candidate must retain the integration-authority gate");
assert.match(serverCandidate, /NO_AZURE_TRAFFIC_AUTHORITY/, "product candidate must retain the Azure-traffic gate");

const clientCandidate = read("apps/mobile/src/services/chatProductIntegrationRc.ts");
assert.match(clientCandidate, /CHAT_PRODUCT_INTEGRATION_ENABLED = false as const/, "client product integration must stay disabled");
assert.match(clientCandidate, /CHAT_PRODUCT_TRAFFIC_ENABLED = false as const/, "client product traffic must stay disabled");

console.log("companion shared composition contract checks passed");
