import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const edge = read("supabase/functions/dice-synthetic/index.ts");
const handler = read("supabase/functions/dice-synthetic/edge-handler-v1.ts");
const adapter = read("supabase/functions/_shared/azure-dice-adapter-v1.ts");
const store = read("supabase/functions/_shared/dice-authority-store-v1.ts");
const environment = read(".env.example");
const bundle = read(".tmp/dice-synthetic-edge-v1-bundle/dice-synthetic.bundle.js");
const evidence = read("config/evidence/s2-t263-azure-foundry-deployment-readonly-v1.json");
const pricingEvidence = read("config/evidence/s2-t263-azure-foundry-pricing-sanitized-v1.json");
const routeEvidence = read("config/evidence/s2-t263-azure-route-family-sanitized-v1.json");
const officialReference = read("config/evidence/s2-t263-microsoft-foundry-responses-v1-reference.json");
const authority = JSON.parse(read("config/s2-t263-dice-edge-authority.json"));
const canonicalManifest = JSON.parse(read("config/s2-t257-canonical-dice-gateway-manifest.json"));
const evidenceSha256 = createHash("sha256").update(evidence).digest("hex");
const pricingEvidenceSha256 = createHash("sha256").update(pricingEvidence).digest("hex");
const routeEvidenceSha256 = createHash("sha256").update(routeEvidence).digest("hex");
const officialReferenceSha256 = createHash("sha256").update(officialReference).digest("hex");

assert.match(edge, /createDiceSyntheticEdgeHandler/);
assert.match(edge, /Deno\.serve\(handler\)/);
assert.doesNotMatch(edge, /gateway-v0-3|registry-adapter-v0-3/);
assert.match(handler, /LUMIS_DICE_AI_ENABLED: dependencies\.environment\.LUMIS_DICE_AI_ENABLED/);
assert.match(handler, /LUMIS_DICE_TRAFFIC_AUTHORIZED: dependencies\.environment\.LUMIS_DICE_TRAFFIC_AUTHORIZED/);
assert.ok(handler.indexOf("if (!providerConfig.ok)") < handler.indexOf("const authorityClient = dependencies.createAuthorityClient("));
assert.match(handler, /Object\.keys\(value\)\.length === 1/);
assert.doesNotMatch(handler, /\.from\(|\.insert\(|\.update\(|chargeUnits|member_id|user_id|birth_date/);
assert.doesNotMatch(`${edge}\n${handler}`, /console\.(?:log|error|warn)|request\.headers\.get\("authorization"\)/);
assert.match(store, /consume_lumis_dice_synthetic_authority_v1/);
assert.match(adapter, /DICE_AZURE_API_VERSION = null/);
assert.match(adapter, /DICE_AZURE_TRAFFIC_AUTHORITY_MISSING/);
assert.match(adapter, /DICE_AZURE_ROUTE_FAMILY = "v1"/);
assert.match(adapter, /lumis-foundry-stg-sea-20260731\.services\.ai\.azure\.com/);
assert.match(adapter, /config\.endpoint !== `https:\/\/\$\{DICE_AZURE_HOSTNAME\}`/);
assert.doesNotMatch(adapter, /DICE_AZURE_API_VERSION\s*=\s*"|apiVersion:\s*"20\d{2}-/);
assert.match(adapter, /\/openai\/\$\{config\.routeFamily\}\/responses/);
assert.doesNotMatch(adapter, /chat\/completions|api-version=/);
assert.match(environment, /^LUMIS_DICE_AI_ENABLED=false$/m);
assert.match(environment, /^LUMIS_DICE_TRAFFIC_AUTHORIZED=false$/m);
assert.ok(bundle.length > 50_000);
for (const marker of ["Deno.serve", "createDiceSyntheticEdgeHandler", "DICE_AZURE_TRAFFIC_AUTHORITY_MISSING", "lumis-foundry-stg-sea-20260731.services.ai.azure.com", "/openai/${config.routeFamily}/responses", "consume_lumis_dice_synthetic_authority_v1", "js-tiktoken"]) assert.ok(bundle.includes(marker), `bundle missing ${marker}`);
assert.equal(evidenceSha256, "e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f");
assert.equal(Buffer.byteLength(evidence), 1267);
assert.equal(evidence.includes("\r"), false);
assert.equal(evidence.endsWith("\n") && !evidence.endsWith("\n\n"), true);
assert.equal(JSON.parse(evidence).not_verified_or_not_collected.azure_api_version, null);
assert.equal(JSON.parse(evidence).evidence_sha256, null);
assert.equal(authority.evidence_sha256, evidenceSha256);
assert.equal(authority.azure_api_version, null);
assert.equal(authority.pricing_verified, true);
assert.equal(authority.pricing_evidence_sha256, pricingEvidenceSha256);
assert.equal(authority.route_family_evidence_sha256, routeEvidenceSha256);
assert.equal(authority.official_reference_sha256, officialReferenceSha256);
assert.equal(authority.api_route_family, "v1");
assert.deepEqual(authority.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(authority.canonical_package_sha256, canonicalManifest.package_sha256);
const route = JSON.parse(routeEvidence);
const reference = JSON.parse(officialReference);
assert.equal(routeEvidenceSha256, "7c9b3e2878513071d59e2357c3ad3dbcaeab44f08f48537a2cbc6cb6753d16d5");
assert.deepEqual(Object.keys(route).sort(), ["api_route_family", "evidence_method", "explicitly_excluded", "observed_at"].sort());
assert.equal(route.api_route_family, "v1");
assert.equal(JSON.stringify(route).includes("/openai/"), false);
assert.equal(officialReferenceSha256, "350a5d8e9bdb7a74093189dd97319c5c951a4a7eb4b1f40ad0953da3a3823944");
assert.equal(reference.source_domain, "learn.microsoft.com");
assert.equal(new URL(reference.source_url).hostname, "learn.microsoft.com");
assert.equal(createHash("sha256").update(reference.source_url).digest("hex"), reference.source_url_sha256);
assert.equal(createHash("sha256").update(reference.source_claim).digest("hex"), reference.source_claim_sha256);
assert.equal(reference.route_family, "v1");
const pricing = JSON.parse(pricingEvidence);
assert.equal(pricingEvidenceSha256, "2c22ddc1fe40689e99c7a74aed4653e64c39a5ed3ba317a259b5637a8bb41772");
assert.equal(pricingEvidence.includes("\r"), false);
assert.equal(pricingEvidence.endsWith("\n") && !pricingEvidence.endsWith("\n\n"), true);
assert.deepEqual(Object.keys(pricing).sort(), [
  "currency", "deployment_alias", "full_maximum_dice_window_estimate_usd", "input_price_usd_per_1m_tokens",
  "output_price_usd_per_1m_tokens", "price_observed_at", "price_sheet_billing_period", "region_evidence",
  "relevant_service_dates",
].sort());
assert.equal(Object.keys(pricing).some((key) => /csv|billing.*id|subscription|resource.*id|credential|token$|key|email/i.test(key)), false);
const fullWindowAttempts = 120 * 2;
const inputMaximum = fullWindowAttempts * 800 * pricing.input_price_usd_per_1m_tokens / 1_000_000;
const outputMaximum = fullWindowAttempts * 300 * pricing.output_price_usd_per_1m_tokens / 1_000_000;
assert.equal(Number((inputMaximum + outputMaximum).toFixed(3)), pricing.full_maximum_dice_window_estimate_usd);
assert.equal(pricing.full_maximum_dice_window_estimate_usd, 0.192);
assert.deepEqual(Object.keys(authority).sort(), [
  "api_route_family", "approved_hostname", "authority_scope", "authority_status", "azure_api_version", "base_commit", "canonical_package_sha256",
  "deployment_alias", "deployment_type", "evidence_file", "evidence_sha256", "guardrail", "model",
  "model_version", "model_version_upgrade_policy", "official_reference_file", "official_reference_sha256",
  "pricing_evidence_file", "pricing_evidence_sha256", "route_family_evidence_file", "route_family_evidence_sha256",
  "pricing_verified", "provider_calls",
  "requests_per_minute", "schema", "task", "tokens_per_minute",
].sort());
assert.equal(Object.keys(authority).some((key) => /endpoint|key|email|masked|screenshot|credential|tenant|subscription|billing/i.test(key)), false);
assert.deepEqual({
  deployment_alias: authority.deployment_alias, model: authority.model, model_version: authority.model_version,
  deployment_type: authority.deployment_type, model_version_upgrade_policy: authority.model_version_upgrade_policy,
  guardrail: authority.guardrail, tokens_per_minute: authority.tokens_per_minute,
  requests_per_minute: authority.requests_per_minute, approved_hostname: authority.approved_hostname,
}, {
  deployment_alias: "lumis-ai-chat-stg", model: "gpt-5-mini", model_version: "2025-08-07",
  deployment_type: "GlobalStandard", model_version_upgrade_policy: "NoAutoUpgrade", guardrail: "Microsoft.DefaultV2",
  tokens_per_minute: 10000, requests_per_minute: 10,
  approved_hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
});

const receipt = JSON.parse(execFileSync(process.execPath, [
  "scripts/s2-t263-dice-edge-receipt.mjs",
  "--disabled-code", "DICE_AI_DISABLED",
  "--provider-calls", "0",
  "--observed-at", "2026-08-11T00:00:00.000Z",
], { encoding: "utf8" }));
assert.equal(receipt.provider_calls, 0);
assert.equal(receipt.units_consumed, 0);
assert.equal(receipt.normal_persistence_writes, 0);
assert.equal(receipt.retention_days, 30);
assert.equal(receipt.azure_api_version, null);
assert.equal(receipt.api_route_family, "v1");
assert.deepEqual(receipt.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(receipt.pricing_verified, true);
assert.equal(receipt.pricing_evidence_sha256, pricingEvidenceSha256);
assert.throws(() => execFileSync(process.execPath, [
  "scripts/s2-t263-dice-edge-receipt.mjs", "--disabled-code", "DICE_AI_DISABLED", "--provider-calls", "1",
], { stdio: "pipe" }));

const changed = execFileSync("git", ["diff", "--name-only", "083af57"], { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort();
assert(changed.length > 20);
assert(changed.every((file) => /^(?:\.env\.example|\.gitignore|package\.json|pnpm-lock\.yaml|config\/|docs\/(?:architecture|qa)\/|scripts\/(?:lib\/)?s2-t(?:257|259|262|263|267|272)|supabase\/(?:functions|migrations\/0039|tests\/lumis-dice|tests\/s2-t259))/.test(file)), "T267/T272 changed outside the Dice runtime release boundary");

console.log(`S2_T267_DICE_EDGE_CONTRACT_OK files=${changed.length} provider_calls=${receipt.provider_calls}`);
