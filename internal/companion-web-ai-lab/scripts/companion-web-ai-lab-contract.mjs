#!/usr/bin/env node
// Static contract checks for the Companion / Normal Chat Web AI Lab.
// Complements the runtime test suite (test/lab-engine.fixtures.ts) with source-level guarantees:
//   - the browser bundle never contacts Azure/Supabase and carries no secrets;
//   - the Lab performs no customer persistence / billing / member-state mutation;
//   - byte-exact founder-approved wording is present;
//   - the provider is default-off.
// Run from the worktree root:  node internal/companion-web-ai-lab/scripts/companion-web-ai-lab-contract.mjs

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
// Scan executable code only (strip comments so reassurance comments don't false-positive).
const appJs = read("public/app.js");
const appCode = appJs.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const forbiddenInBrowser = ["services.ai.azure.com", ".supabase.co", "supabase.", "api-key", "apikey", "api_key", "service_role", "LUMIS_CHAT", "eyJ", "sk-"];
for (const token of forbiddenInBrowser) {
  check(`browser code has no "${token}"`, !appCode.toLowerCase().includes(token.toLowerCase()), `found "${token}" in public/app.js code`);
}
const fetchTargets = [...appCode.matchAll(/fetch\(\s*("|`)([^"`]+)\1/g)].map((m) => m[2]);
check("browser fetches only same-origin /api/lab/*", fetchTargets.length > 0 && fetchTargets.every((u) => u.startsWith("/api/lab/")), `targets: ${JSON.stringify(fetchTargets)}`);

// ---- 2. No customer persistence / billing / member-state mutation anywhere in the Lab ----
const srcFiles = ["src/lab-engine.ts", "src/lab-turn.ts", "src/lab-provider.ts", "src/lab-templates.ts", "src/lab-constants.ts", "src/lab-safety.ts", "src/server.ts"];
const src = srcFiles.map(read).join("\n");
for (const token of ["createClient(", "postgres-authority", "authority-store", ".insert(", ".update(", ".upsert(", "SERVICE_ROLE", "chat-message/index", "unit_ledger", "commitAtomicSuccess"]) {
  check(`Lab performs no persistence/billing token "${token}"`, !src.includes(token), `found "${token}" in Lab source`);
}
check("responses are disposable (units_charged: 0)", read("src/lab-engine.ts").includes('units_charged: 0'));
check("responses are not committed", read("src/lab-engine.ts").includes('persistence: "not_committed"'));

// ---- 3. Provider is default-off; server config exposes no secret ----
const server = read("src/server.ts");
check("provider default-off gate present", server.includes('LUMIS_CHAT_AI_ENABLED === "true"') && server.includes("LUMIS_CHAT_AZURE_API_KEY"));
check("config endpoint returns only ai_enabled boolean (no key echo)", !/LUMIS_CHAT_AZURE_API_KEY\s*[},]/.test(server.replace('(process.env.LUMIS_CHAT_AZURE_API_KEY ?? "")', "")) );
check("telemetry documented content-free", server.includes("Content-free"));

// ---- 4. Byte-exact founder-approved wording present in the reused registry ----
const registry = read("../../supabase/functions/_shared/fixed-template-registry.ts");
check("Solar Return EN byte-exact", registry.includes('text: "Solar Return is not part of Lumis."'));
check("Solar Return ZH byte-exact", registry.includes("Solar Return 不屬於 Lumis 的服務範圍。"));
check("Router unavailable EN byte-exact", registry.includes('text: "I am temporarily unable to process that message. Please try again shortly."'));
check("CRISIS/DISTRESS marked clinical-review", registry.includes('status: "provisional_clinical_review_required"'));

// ---- 5. Not represented as the signed-off customer UI ----
check("UI carries the internal / not-signed-off banner", read("public/index.html").includes("not") && read("public/index.html").includes("signed-off customer Chat UI"));

// ---- 6. Live 12-case window (fixture-gated) ----
// Browser live call submits ONLY schema_version + fixture_id (no free text/role/chart).
const liveBody = (appCode.match(/fetch\("\/api\/lab\/live"[\s\S]{0,240}?body:\s*JSON\.stringify\(\{[\s\S]*?\}\)/) || [""])[0];
check("browser calls /api/lab/live", appCode.includes('fetch("/api/lab/live"'));
check("live call submits only schema_version + fixture_id", /fixture_id/.test(liveBody) && /schema_version/.test(liveBody) && !/\bmessage\b/.test(liveBody) && !/\bchart\b/.test(liveBody) && !/\brole_code\b/.test(liveBody), liveBody.slice(0, 120));
check("free text still posts to offline /api/lab/message", appCode.includes('fetch("/api/lab/message"'));

const win = read("src/lab-live-window.ts");
check("live window reuses the Founder authority validator", win.includes("validateFounderChatWindowAuthority"));
check("live window binds the authorized packet SHA", win.includes('"05b7a182de81f8de64d0c91475b24568d4470fd13ff716f16f372acb3e6e19b0"'));
check("live window binds the authorized commit", win.includes('"93e578fe7ba7438734c4e79c4e629bf1393b73c8"'));
for (const cap of ["logical: 12", "en: 6", "zhHant: 6", "attempts: 24", "concurrency: 1", "deadlineMs: 12_000", "retries: 1", "inputTokens: 1200", "outputTokens: 300", "windowMs: 900_000"]) {
  check(`live caps include "${cap}"`, win.includes(cap));
}
check("live window disables in finally (single-use / completion)", win.includes('finally') && win.includes('"COMPLETED"'));
check("live window disables on expiry / cap breach / deviation", win.includes('"EXPIRED"') && win.includes('"CAP_BREACH"') && win.includes('"DEVIATION"') && win.includes("ATTEMPT_CAP_BREACH"));
check("live window uses an atomic mutex + durable persist", win.includes("runExclusive") && win.includes("writeFileSync") && win.includes("readFileSync"));
check("live responses disposable (0 units, not_committed)", win.includes("units_charged: 0") && win.includes('persistence: "not_committed"'));
check("live window does not log raw prompt/response text", !/stdout[\s\S]{0,40}serverPromptInput/.test(win) && !/console\.log[\s\S]{0,40}assistant_message/.test(win));

const founder = read("../../supabase/functions/_shared/founder-chat-window-v1.ts");
const enIds = (founder.match(/"chat_en_[a-z_]+_v1"/g) || []).length;
const zhIds = (founder.match(/"chat_zh_hant_[a-z_]+_v1"/g) || []).length;
check("founder allowlist has exactly 12 fixtures (6 EN / 6 zh-Hant)", enIds === 6 && zhIds === 6, `en=${enIds} zh=${zhIds}`);
check("server exposes /api/lab/live and status", read("src/server.ts").includes('"/api/lab/live"') && read("src/server.ts").includes('"/api/lab/live/status"'));

console.log(failures === 0 ? "\nCONTRACT OK" : `\nCONTRACT FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
