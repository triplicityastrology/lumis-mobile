#!/usr/bin/env node
// Static contract checks for the Founder Companion Web AI Lab (free-text, multi-turn pivot).
// Complements the runtime suites (test/lab-{engine,identity,conversation,regression}.fixtures.ts)
// with source-level guarantees:
//   - the browser bundle never contacts Azure/Supabase and carries no secrets;
//   - the browser talks only to same-origin /api/lab/* and holds conversation context itself
//     (New/Clear remove it) with NO per-message cap;
//   - the Lab performs no customer persistence / billing / member-state mutation and never
//     persists or logs raw conversation text;
//   - provider access is gated by the executable-identity authorization + the LUMIS_AI_ENABLED
//     kill switch, checked BEFORE any Azure key access;
//   - the reused persona/companion prompt pipeline is preserved (not a simplified replacement);
//   - the 12 frozen regression fixtures are present but optional;
//   - byte-exact founder-approved wording is present.
// Run from the Lab dir root:  node internal/companion-web-ai-lab/scripts/companion-web-ai-lab-contract.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) { console.log(`ok   ${name}`); }
  else { console.log(`FAIL ${name}${detail ? " — " + detail : ""}`); failures++; }
}

// ---- 1. Browser bundle never contacts Azure/Supabase and carries no secrets ----
const appJs = read("public/app.js");
const appCode = appJs.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
// Credentials/endpoints only. The disable-control NAME (LUMIS_AI_ENABLED) may appear as UI copy —
// it is a public control name, not a secret — so it is not forbidden here.
const forbiddenInBrowser = ["services.ai.azure.com", ".supabase.co", "supabase.", "api-key", "apikey", "api_key", "service_role", "LUMIS_CHAT_AZURE_API_KEY", "eyJ", "sk-"];
for (const token of forbiddenInBrowser) {
  check(`browser code has no "${token}"`, !appCode.toLowerCase().includes(token.toLowerCase()), `found "${token}" in public/app.js code`);
}
const fetchTargets = [...appCode.matchAll(/fetch\(\s*("|`)([^"`]+)\1/g)].map((m) => m[2]);
check("browser fetches only same-origin /api/lab/*", fetchTargets.length > 0 && fetchTargets.every((u) => u.startsWith("/api/lab/")), `targets: ${JSON.stringify(fetchTargets)}`);

// ---- 2. The browser holds a BOUNDED rolling context itself; New/Clear remove it; no message cap ----
check("browser holds conversation context in-session", /let\s+conversation\s*=\s*\[\]/.test(appCode));
check("New conversation empties context", /newConversation\s*\(\)\s*\{[^}]*conversation\s*=\s*\[\]/.test(appCode));
check("Clear session removes context (bound to newConversation)", appCode.includes('"clear-session"') && /clear-session[\s\S]{0,60}newConversation/.test(appCode));
check("context is bounded by the server-declared max (rolling window)", appCode.includes("slice(-MAX_CONTEXT") && appCode.includes("max_context_turns"));
check("conversation payload sends role+chart+message+context (natural free text)", /\/api\/lab\/conversation/.test(appCode) && /role_code/.test(appCode) && /chart:\s*chart\(\)/.test(appCode) && /message,/.test(appCode) && /context:\s*priorContext/.test(appCode));
check("no client-side per-message cap on sending", !/messagesSent\s*>=|turnCount\s*>=|>=\s*12|max_messages/.test(appCode));
// Regression call submits ONLY schema_version + fixture_id (no free text / role / chart).
const regBody = (appCode.match(/\/api\/lab\/regression[\s\S]{0,220}?body:\s*JSON\.stringify\(\{[\s\S]*?\}\)/) || [""])[0];
check("regression call submits only schema_version + fixture_id", /fixture_id/.test(regBody) && /schema_version/.test(regBody) && !/\bmessage\b/.test(regBody) && !/\bchart\b/.test(regBody) && !/\brole_code\b/.test(regBody), regBody.slice(0, 120));

// ---- 3. No customer persistence / billing / member-state mutation anywhere in the Lab ----
const srcFiles = [
  "src/lab-engine.ts", "src/lab-turn.ts", "src/lab-provider.ts", "src/lab-templates.ts",
  "src/lab-constants.ts", "src/lab-conversation.ts", "src/lab-regression.ts", "src/lab-identity.ts",
  "src/lab-azure-responses-adapter.ts", "src/server.ts",
];
const src = srcFiles.map(read).join("\n");
// Note: ".update(" is intentionally excluded — it collides with crypto createHash().update() in
// lab-identity.ts. DB writes are caught by .insert(/.upsert(/client tokens below.
for (const token of ["createClient(", "postgres-authority", "authority-store", ".insert(", ".upsert(", ".from('", '.from("', "SERVICE_ROLE", "chat-message/index", "unit_ledger", "commitAtomicSuccess"]) {
  check(`Lab performs no persistence/billing token "${token}"`, !src.includes(token), `found "${token}" in Lab source`);
}
check("responses are disposable (units_charged: 0)", read("src/lab-engine.ts").includes("units_charged: 0"));
check("responses are not committed", read("src/lab-engine.ts").includes('persistence: "not_committed"'));

// ---- 4. Raw conversation text is never persisted or logged ----
const conversation = read("src/lab-conversation.ts");
const server = read("src/server.ts");
check("server holds no conversation state / never persists raw text (documented + no store)", server.includes("never persists") && !/\.write(File)?Sync?\([^)]*message/.test(server));
check("telemetry is content-free (no message/context/assistant text in the emitted record)", server.includes("Content-free") && !/stdout[\s\S]{0,80}(message|context|assistant_message)/.test(server));
check("conversation handler does not log raw text", !/console\.log[\s\S]{0,60}(request\.message|\.context|assistant_message)/.test(conversation) && !/stdout[\s\S]{0,60}(request\.message|\.context)/.test(conversation));

// ---- 5. Provider access gated by executable identity + kill switch, BEFORE any Azure key ----
const identity = read("src/lab-identity.ts");
check("scope is the free-text staging executable-identity scope", identity.includes('"FOUNDER_INTERNAL_CHAT_LAB_FREE_TEXT_STAGING"'));
check("no legacy 900s / per-question window remains", !identity.includes("windowMs") && !identity.includes("900_000") && !identity.includes("valid_until"));
for (const bind of ["final_commit", "final_tree", "package_checksum", "prompt_version", "azure_deployment", "azure_hostname", "disable_control", "reviewer", "environment"]) {
  check(`identity receipt binds ${bind}`, identity.includes(bind));
}
check("kill switch is LUMIS_AI_ENABLED=false", identity.includes('env[LAB_DISABLE_CONTROL] === "false"') && identity.includes('LAB_DISABLE_CONTROL = "LUMIS_AI_ENABLED"'));
check("authorize order: kill switch -> identity -> Azure config", identity.indexOf("killSwitchEngaged(env)") < identity.indexOf("verify()") && identity.indexOf("verify()") < identity.indexOf("resolveProviderRuntime("));
check("verification checks a CLEAN worktree + commit/tree/package match", ["LAB_IDENTITY_WORKTREE_DIRTY", "LAB_IDENTITY_COMMIT_MISMATCH", "LAB_IDENTITY_TREE_MISMATCH", "LAB_IDENTITY_PACKAGE_MISMATCH"].every((t) => identity.includes(t)));
check("receipt is minted post-commit and verified against runtime (no self-reference at mint)", identity.includes("mintIdentityReceipt") && identity.includes("runtimeIdentity()") && identity.includes("OPERATOR / GENERATOR ONLY"));
check("server gates providerReady through authorizeProvider (constructs, never calls, Azure)", server.includes("authorizeProvider(process.env"));
check("server default-off: no key echoed in config payload", !/api_key|LUMIS_CHAT_AZURE_API_KEY/i.test(server));
const provider = read("src/lab-provider.ts");
check("provider still reuses the server-side Azure config gate", provider.includes("readChatAzureServerConfig") && provider.includes("createLabAzureResponsesAdapter"));

// ---- 6. Existing persona/companion prompt pipeline preserved (NOT a simplified replacement) ----
check("conversation reuses serializePersonaPrompt + runGenerative (no bespoke prompt)", conversation.includes("serializePersonaPrompt(") && conversation.includes("runGenerative("));
check("prompt is assembled by the reused persona-prompt-pipeline", provider.includes("persona-prompt-pipeline") || read("src/lab-engine.ts").includes("persona-prompt-pipeline-v1.ts"));
check("multi-turn context is threaded into the same persona prompt", provider.includes("CONVERSATION CONTINUITY"));
check("prompt version binds companion-synthetic + persona pipeline", identity.includes("COMPANION_SYNTHETIC_PROMPT_VERSION") && identity.includes("PERSONA_PROMPT_PIPELINE_VERSION"));

// ---- 7. The 12 frozen regression fixtures are present but OPTIONAL ----
const registrySrc = read("src/lab-live-registry.ts");
const regFounder = read("../../supabase/functions/_shared/founder-chat-window-v1.ts");
const enIds = (regFounder.match(/"chat_en_[a-z_]+_v1"/g) || []).length;
const zhIds = (regFounder.match(/"chat_zh_hant_[a-z_]+_v1"/g) || []).length;
check("regression allowlist has exactly 12 fixtures (6 EN / 6 zh-Hant)", enIds === 6 && zhIds === 6, `en=${enIds} zh=${zhIds}`);
check("regression is a separate optional path (own schema + endpoint)", read("src/lab-regression.ts").includes('"companion_web_ai_lab_regression_request_v1"') && server.includes('"/api/lab/regression"'));
check("regression reuses the frozen synthetic gateway (not a new prompt)", read("src/lab-regression.ts").includes("ChatSyntheticRun") && registrySrc.includes("serverPromptInput"));
check("regression is gated by the SAME authorizeProvider", read("src/lab-regression.ts").includes("authorizeProvider("));

// ---- 8. Not represented as the signed-off customer UI; endpoints as designed ----
const indexHtml = read("public/index.html");
check("UI carries the internal / not-signed-off banner", indexHtml.includes("FOUNDER-ONLY") && indexHtml.includes("not") && indexHtml.includes("signed-off customer Chat UI"));
check("server exposes config + conversation + regression + identity status", ["/api/lab/config", "/api/lab/conversation", "/api/lab/regression", "/api/lab/identity/status"].every((r) => server.includes(`"${r}"`)));
check("legacy /api/lab/message and /api/lab/live endpoints are gone", !server.includes('"/api/lab/message"') && !server.includes('"/api/lab/live"'));

// ---- 9. Sprint-2 correction findings (loopback bind, fixed git argv, no preview, adapter) ----
const identitySrc = read("src/lab-identity.ts");
// (1) Argument-safe git: fixed argv via execFileSync; never a shell string.
check("git runs via execFileSync with fixed argv (no shell string)", identitySrc.includes("execFileSync(\"git\", [...argv]") && !identitySrc.includes("execSync(`git"));
check("git call sites pass fixed argv arrays", identitySrc.includes('["rev-parse", "HEAD"]') && identitySrc.includes('["status", "--porcelain"]') && identitySrc.includes('["ls-files", "--", LAB_SOURCE_GLOB]'));
// (2) Loopback-only binding; no LAN/public-host override.
check("server binds to 127.0.0.1 only", /listen\(PORT,\s*LOOPBACK_HOST/.test(server) && server.includes('LOOPBACK_HOST = "127.0.0.1"'));
check("server does not allow a host override or bind 0.0.0.0", !server.includes("0.0.0.0") && !/process\.env\.[A-Z_]*HOST/.test(server));
// (3) No assembled-prompt preview in browser or server responses.
// Founder re-enabled the assembled-prompt preview for internal Lab testing (reverses the earlier
// removal). Still Founder-only/internal, never the customer UI.
check("server response includes the Founder-internal generative_prompt_preview", read("src/lab-turn.ts").includes("generative_prompt_preview") && read("src/lab-engine.ts").includes("generative_prompt_preview"));
check("browser renders the assembled persona prompt (Founder-internal)", appJs.includes("generative_prompt_preview") && appJs.includes("Assembled prompt"));
check("Calculate/compose endpoint present (derive composition + prompt, no provider)", read("src/server.ts").includes('"/api/lab/compose"') && read("src/lab-compose.ts").includes("assemblePersona"));
// (3b) Basic natal Knowledge Bank grounding (Founder-directed; controlled bank content only).
const kb = read("src/lab-knowledge-bank.ts");
check("Knowledge Bank uses controlled bank content, planet-in-sign only (no invention)", kb.includes("Founder-Approved") && kb.includes("retrieveNatalFacts") && kb.includes("buildKnowledgeGrounding"));
check("KB suppresses unconfirmed Moon + excludes houses/timing (birth-time gate)", kb.includes("Moon unconfirmed") && kb.includes("planet-in-sign"));
check("KB grounding threaded into the persona prompt", read("src/lab-provider.ts").includes("memberContext") && read("src/lab-conversation.ts").includes("buildKnowledgeGrounding"));
check("KB facts surfaced in the browser thinking-process view", appJs.includes("knowledge_bank") && appJs.includes("renderKB"));
// (4) Corrected Azure Responses adapter boundary + metadata-only disposition.
const adapter = read("src/lab-azure-responses-adapter.ts");
check("adapter preserves /openai/v1/responses + deployment + store:false + max_output_tokens", adapter.includes("/openai/${config.routeFamily}/responses") && adapter.includes("model: config.deployment") && adapter.includes("store: false") && adapter.includes("max_output_tokens: Math.max(input.maxOutputTokens") && adapter.includes('reasoning: { effort: "minimal" }'));
check("adapter preserves both output_text and output[].content[].text extraction", adapter.includes("value.output_text") && adapter.includes('content.type === "output_text"'));
for (const d of ["http_or_schema_rejected", "incomplete_or_content_filter", "completed_empty_output", "completed_non_text_output", "completed_text"]) {
  check(`adapter distinguishes disposition "${d}"`, adapter.includes(`"${d}"`));
}
check("provider_disposition is metadata-only (no bodies/headers/urls/keys retained)", !/response\.headers|value\.output_text\s*\)\s*;\s*\/\/\s*log|console\.log|process\.stdout/.test(adapter) && adapter.includes("never retains or exposes response bodies"));

// ---- 10. Byte-exact founder-approved wording present in the reused registry ----
const registry = read("../../supabase/functions/_shared/fixed-template-registry.ts");
check("Solar Return EN byte-exact", registry.includes('text: "Solar Return is not part of Lumis."'));
check("Solar Return ZH byte-exact", registry.includes("Solar Return 不屬於 Lumis 的服務範圍。"));
check("Router unavailable EN byte-exact", registry.includes('text: "I am temporarily unable to process that message. Please try again shortly."'));
check("CRISIS/DISTRESS marked clinical-review", registry.includes('status: "provisional_clinical_review_required"'));

console.log(failures === 0 ? "\nCONTRACT OK" : `\nCONTRACT FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
