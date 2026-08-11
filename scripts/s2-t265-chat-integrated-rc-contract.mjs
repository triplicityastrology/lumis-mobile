import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const json = (path) => JSON.parse(read(path));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalJson = (value) => Array.isArray(value)
  ? `[${value.map(canonicalJson).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const require = createRequire(import.meta.url);

const candidate = json("config/s2-t265-chat-integrated-rc.json");
const { package_binding_sha256: packageBinding, ...boundCandidate } = candidate;
assert.equal(sha256(JSON.stringify(boundCandidate)), packageBinding, "candidate package binding drift");
assert.equal(candidate.schema, "s2_t265_chat_integrated_rc_v1");
assert.equal(candidate.task, "S2-T265");
assert.equal(candidate.base_commit, "aff17b9698f37d6e251dce3b1aeda73005e91faa");
assert.equal(candidate.accepted_t240_commit, "beab3bc47d3d32fd0e76673f538f47f368f95347");
assert.deepEqual(candidate.statuses, ["SOURCE_ONLY", "LOCAL_EMULATOR_ONLY", "NO_AZURE_TRAFFIC_AUTHORITY", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY"]);
assert.equal(candidate.accepted_dice_evidence_sha256, null);
assert.equal(candidate.authorization_issued, false);
assert.equal(candidate.network_executed, false);
assert.equal(candidate.deployment_executed, false);
assert.equal(candidate.migration_0040_executed, false);
assert.equal(candidate.normal_chat_connected, false);
assert.equal(candidate.microsoft_readonly_evidence_sha256, "e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f");
assert.equal(candidate.sanitized_pricing_evidence_sha256, "8d8a3d9b155d950ea76f23808f4eec6b507de8a02203d233522c3583f22e799b");
assert.equal(candidate.api_route_family, "v1");
assert.equal(candidate.api_route_family_evidence_sha256, "2dec65e48845fe4fd2ecedd4d83ce10857b2a773a25855d0bea7454bedb4490e");
assert.equal(candidate.official_microsoft_v1_reference_evidence_sha256, "5086b0c4bb0fc7cd02d82c94c594897b71d191e72bf23108dfa26cf32d48bab5");
assert.equal(candidate.azure_api_version, null);
assert.equal(candidate.azure_api_version_verification, "unverified");
assert.equal(candidate.azure_api_version_evidence_sha256, null);
assert.equal(candidate.provider_or_client_construction_allowed, false);

for (const [path, expected] of Object.entries(candidate.source_sha256)) {
  assert.equal(sha256(read(path)), expected, `candidate checksum drift: ${path}`);
}
for (const [path, expected] of Object.entries(candidate.accepted_t240_artifact_sha256)) {
  assert.equal(sha256(read(path)), expected, `accepted T240 artifact drift: ${path}`);
}

const authorizationSchema = json("supabase/tests/s2-t265-chat-authorization.schema.json");
assert.equal(authorizationSchema.$id, "s2_t265_chat_authorization_v1");
assert.equal(authorizationSchema.properties.prerequisite_authority.const, "ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE");
assert.equal(authorizationSchema.properties.canonical_t240_schema_sha256.const, candidate.canonical_t240_schema_sha256);

const microsoft = json("config/s2-t265-microsoft-chat-manifest.json");
assert.equal(sha256(canonicalJson(microsoft)), candidate.microsoft_manifest_sha256);
assert.deepEqual(microsoft.verified_deployment_names, {
  deployment_alias: "lumis-ai-chat-stg",
  model: "gpt-5-mini",
  model_version: "2025-08-07",
  deployment_type: "GlobalStandard",
  model_version_upgrade_policy: "NoAutoUpgrade",
  guardrail: "Microsoft.DefaultV2",
  tokens_per_minute_limit: 10000,
  requests_per_minute_limit: 10,
  foundry_service_hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com"
});
assert.equal(microsoft.transport_policy, "HTTPS_ONLY_EXACT_HOSTNAME");
assert.equal(microsoft.azure_api_version, null);
assert.equal(microsoft.azure_api_version_verification, "unverified");
assert.equal(microsoft.organization_specific_pricing, null);
assert.equal(microsoft.organization_specific_pricing_verification, "unverified");
assert.equal(microsoft.sanitized_pricing_evidence_sha256, candidate.sanitized_pricing_evidence_sha256);
assert.equal(microsoft.sanitized_pricing_gives_deployment_or_traffic_authority, false);
assert.equal(microsoft.api_route_family, "v1");
assert.equal(microsoft.api_route_family_evidence_sha256, candidate.api_route_family_evidence_sha256);
assert.equal(microsoft.official_microsoft_v1_reference_evidence_sha256, candidate.official_microsoft_v1_reference_evidence_sha256);
assert.equal(microsoft.preview_route_allowed, false);
assert.equal(microsoft.legacy_date_formatted_api_version_allowed, false);
assert.equal(microsoft.model_version_inference_allowed, false);
assert.equal(microsoft.route_family_evidence_gives_deployment_or_traffic_authority, false);
assert.equal(microsoft.lumis_safety.deterministic_pre_safety, true);
assert.equal(microsoft.lumis_safety.deterministic_post_safety, true);
assert.deepEqual(microsoft.operations, {
  provider_or_client_construction_allowed: false,
  network_executed: false,
  deployment_executed: false,
  migration_0040_executed: false,
  normal_chat_connected: false
});
assert.equal(microsoft.authorization.prerequisite, "ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE");
assert.doesNotMatch(JSON.stringify(microsoft), /https?:\/\/|endpoint|path|api.?key|email|masked|screenshot/iu);

const microsoftEvidenceText = read("config/evidence/s2-t265-lumis-azure-foundry-deployment-readonly-v1.json");
const microsoftEvidence = JSON.parse(microsoftEvidenceText);
assert.equal(sha256(microsoftEvidenceText), candidate.microsoft_readonly_evidence_sha256);
assert.equal(microsoftEvidenceText.endsWith("\n"), true);
assert.equal(microsoftEvidenceText.endsWith("\n\n"), false);
assert.equal(microsoftEvidence.not_verified_or_not_collected.azure_api_version, null);
assert.equal(microsoftEvidence.evidence_sha256, null);
assert.equal(microsoftEvidence.authority_status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(microsoftEvidence.authority_status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

const pricingText = read("config/evidence/s2-t265-sanitized-pricing-v1.json");
const pricing = JSON.parse(pricingText);
assert.equal(sha256(pricingText), candidate.sanitized_pricing_evidence_sha256);
assert.deepEqual(Object.keys(pricing), [
  "price_sheet_billing_period", "relevant_service_dates", "price_observed_at",
  "input_price_usd_per_1m_tokens", "output_price_usd_per_1m_tokens", "region_evidence",
  "currency", "full_maximum_dice_window_estimate_usd", "deployment_alias"
]);
assert.equal(pricingText.endsWith("\n"), true);
assert.equal(pricingText.endsWith("\n\n"), false);
assert.doesNotMatch(pricingText, /csv|billing[_ -]?(?:account|id)|subscription[_ -]?id|resource[_ -]?id|credential|api.?key|access[_ -]?token|bearer/iu);
const diceCost = microsoft.dice_window_cost_basis.maximum_provider_attempts * (
  microsoft.dice_window_cost_basis.maximum_input_tokens_per_attempt * pricing.input_price_usd_per_1m_tokens / 1_000_000 +
  microsoft.dice_window_cost_basis.maximum_output_tokens_per_attempt * pricing.output_price_usd_per_1m_tokens / 1_000_000
);
assert.ok(Math.abs(diceCost - pricing.full_maximum_dice_window_estimate_usd) < 1e-12, "sanitized Dice cap arithmetic drift");
assert.equal(pricing.full_maximum_dice_window_estimate_usd, 0.192);
assert.equal(pricing.deployment_alias, microsoft.verified_deployment_names.deployment_alias);

const apiRouteText = read("config/evidence/s2-t265-sanitized-api-route-family-v1.json");
const apiRouteEvidence = JSON.parse(apiRouteText);
assert.equal(sha256(apiRouteText), candidate.api_route_family_evidence_sha256);
assert.deepEqual(Object.keys(apiRouteEvidence), ["api_route_family", "evidence_method", "observed_at", "explicitly_excluded"]);
assert.equal(apiRouteEvidence.api_route_family, "v1");
assert.deepEqual(apiRouteEvidence.explicitly_excluded, ["endpoint_url_or_path", "key", "subscription", "tenant", "email", "account_identifier"]);
assert.equal(apiRouteText.endsWith("\n"), true);
assert.equal(apiRouteText.endsWith("\n\n"), false);

const microsoftReferenceText = read("config/evidence/s2-t265-microsoft-foundry-responses-v1-reference.json");
const microsoftReference = JSON.parse(microsoftReferenceText);
assert.equal(sha256(microsoftReferenceText), candidate.official_microsoft_v1_reference_evidence_sha256);
assert.equal(microsoftReference.source_url, "https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses");
assert.equal(new URL(microsoftReference.source_url).hostname, "learn.microsoft.com");
assert.equal(microsoftReference.documented_api_version, "v1");
assert.equal(microsoftReference.model_version_inference_allowed, false);
assert.equal(microsoftReference.evidence_grants_deployment_or_traffic_authority, false);

const packageJson = json("package.json");
assert.equal(packageJson.devDependencies["js-tiktoken"], "1.0.21");
assert.match(read("supabase/functions/_shared/chat-tokenizer-v1.ts"), /getEncoding\(CHAT_TOKENIZER_VERSION\)/);
assert.match(read("supabase/functions/_shared/chat-tokenizer-v1.ts"), /o200k_base/);
const migration = read("supabase/migrations/0040_chat_synthetic_authority_ledger.sql");
assert.match(migration, /enable row level security/);
assert.match(migration, /retention_until/);
assert.doesNotMatch(migration, /\b(?:member_id|prompt_text|response_text|units_charged)\s+(?:text|uuid|integer|bigint|jsonb)\b/iu);

const authorizationSource = read("supabase/functions/_shared/chat-synthetic-integrated-authorization-v1.ts");
const emulatorSource = read("supabase/functions/_shared/chat-synthetic-local-emulator-v1.ts");
assert.match(authorizationSource, /canonicalSha256\(input\.diceEvidence\)/);
assert.match(authorizationSource, /ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE/);
assert.match(authorizationSource, /this\.#portFactory\(\)/);
assert.match(authorizationSource, /CHAT_SYNTHETIC_AZURE_API_VERSION_EVIDENCE_REQUIRED/);
assert.match(authorizationSource, /validateMicrosoftReadonlyEvidence/);
assert.match(authorizationSource, /validateApiRouteEvidence/);
assert.match(authorizationSource, /value !== null/);
assert.doesNotMatch(authorizationSource, /2024-\d{2}-\d{2}|2023-\d{2}-\d{2}/);
assert.doesNotMatch(emulatorSource, /\bfetch\b|Deno\.|chat-message|SUPABASE_|AZURE_OPENAI_/);
assert.doesNotMatch(emulatorSource, /console\.(?:log|info|warn|error)/);

const { runLocalChatEmulator } = require("../.tmp/chat-synthetic-gateway-tests/supabase/functions/_shared/chat-synthetic-local-emulator-v1.js");
const { validateMobileResponse } = await import("./lib/s2-normal-chat-mobile-response-validator.mjs");
const t240Schema = json("supabase/tests/s2-t193-normal-chat-contract-v1.schema.json");
const projectionCases = [
  ["chat_en_small_decision_v1", "completed"],
  ["chat_zh_hant_small_decision_v1", "idempotent_replay"],
  ["chat_en_overthinking_v1", "timeout"],
  ["chat_zh_hant_unsafe_harm_v1", "safety"],
  ["chat_en_waiting_v1", "malformed"],
  ["chat_zh_hant_boundary_v1", "filter_partial"]
];
for (const [fixture_id, scenario] of projectionCases) {
  const result = await runLocalChatEmulator({
    fixture_id,
    idempotency_key: `t240-map-${scenario}-0001`,
    run_id: "chat-syn-t240mapping01",
    surface: "ordinary_chat_projection",
    scenario
  });
  assert.equal(result.network_allowed, false);
  assert.deepEqual(result.effects, { persistence_writes: 0, units_charged: 0, raw_logs: 0 });
  assert.deepEqual(result.microsoft_deployment_names, microsoft.verified_deployment_names);
  for (const response of result.responses) validateMobileResponse(response, t240Schema);
}

const changed = execFileSync("git", ["status", "--porcelain"], { cwd: new URL(".", root), encoding: "utf8" })
  .trim().split("\n").filter(Boolean).map((line) => line.slice(3));
for (const path of changed) {
  assert.doesNotMatch(path, /^apps\/mobile\//, `mobile integration prohibited: ${path}`);
  assert.doesNotMatch(path, /^supabase\/functions\/chat-message\//, `normal chat integration prohibited: ${path}`);
  assert.doesNotMatch(path, /^supabase\/migrations\//, `migration change prohibited: ${path}`);
}
const t240Changed = execFileSync("git", ["diff", "--name-only", candidate.base_commit, "--", ...Object.keys(candidate.accepted_t240_artifact_sha256)], { cwd: new URL(".", root), encoding: "utf8" }).trim();
assert.equal(t240Changed, "", "accepted T240 public response artifacts must remain unchanged from exact T260 base");

console.log(`S2-T265 integrated candidate contract passed (${projectionCases.length} T240 projections; network=disabled)`);
