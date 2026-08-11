import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DICE_RUNTIME_COMMIT,
  DICE_RUNTIME_CONTROL_SHA256,
  DICE_RUNTIME_PROOF_SHA256,
  DICE_TECHNICAL_AUTHORITY,
  validateDeploymentRequest,
  validateDiceEvidence,
  validateMigrationRequest,
  validateTrafficRequest,
} from "./lib/s2-t281-chat-final-request.mjs";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = json("config/s2-t281-chat-final-request-seal.json");
const { package_binding_sha256: binding, ...bound } = manifest;
assert.equal(sha(JSON.stringify(bound)), binding);
assert.deepEqual(manifest.statuses, ["SOURCE_READY", "LOCAL_DENO_RUNTIME_PROVED", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
for (const [file, digest] of Object.entries(manifest.source_sha256)) assert.equal(sha(read(file)), digest, `STOP_S2_T281_SOURCE_DRIFT:${file}`);

const runtime = json("config/evidence/s2-t276-chat-deno-runtime-proof.json");
assert.deepEqual([runtime.check, runtime.local_serve, runtime.disabled_probe_count, runtime.disabled_code, runtime.provider_calls, runtime.remote_imports], ["passed", "passed", 4, "CHAT_AI_DISABLED", 0, 0]);
const handler = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("request.json()"));
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("const authorityClient = dependencies.createAuthorityClient"));
assert.doesNotMatch(handler, /chat-message|member_id|account_id|console\.(?:log|warn|error)/);

const port = read("supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts");
for (const value of [DICE_RUNTIME_COMMIT, DICE_RUNTIME_CONTROL_SHA256, DICE_RUNTIME_PROOF_SHA256, DICE_TECHNICAL_AUTHORITY]) assert.match(port, new RegExp(value));
assert.doesNotMatch(port, /adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71/);
const diceEvidence = {
  schema: "lumis_dice_technical_window_acceptance_v2", review_decision: "accepted",
  runtime_source_commit: DICE_RUNTIME_COMMIT, runtime_control_sha256: DICE_RUNTIME_CONTROL_SHA256,
  runtime_proof_sha256: DICE_RUNTIME_PROOF_SHA256, technical_window_authority: DICE_TECHNICAL_AUTHORITY,
  technical_evidence_package_sha256: "a".repeat(64), logical_total: 80, en: 40, zh_hant: 40,
  provider_disabled_verified: true, founder_cases_run: 0, persistence_writes: 0, units_charged: 0,
  accepted_at: "2026-08-11T12:00:00.000Z"
};
validateDiceEvidence(diceEvidence, "b".repeat(64));
for (const hostile of [
  { ...diceEvidence, runtime_source_commit: "0".repeat(40) },
  { ...diceEvidence, technical_window_authority: "FOUNDER_40" },
  { ...diceEvidence, logical_total: 79 },
  { ...diceEvidence, provider_disabled_verified: false },
  { ...diceEvidence, account_id: "forbidden" },
]) assert.throws(() => validateDiceEvidence(hostile, "b".repeat(64)));

const now = Date.now();
const common = { project_ref: "bmqhwofmdgebpcihjlnb", review_package_sha256: binding, source_commit: "c".repeat(40), issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString(), nonce: "d".repeat(32) };
const deployment = { schema: "s2_t281_chat_default_off_deployment_request_v1", authority: "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY", ...common, function_name: "chat-synthetic", provider_enabled: false, provider_calls_allowed: 0, disabled_probe_count: 4, migration_0040_authorized: false, traffic_authorized: false, normal_chat_connected: false, rollback_revision_sha256: "e".repeat(64) };
const migration = { schema: "s2_t281_chat_migration_0040_request_v1", authority: "CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY", ...common, migration_version: "0040", migration_sha256: manifest.migration_0040_sha256, function_deployment_authorized: false, traffic_authorized: false, provider_calls_allowed: 0 };
validateDeploymentRequest(deployment, manifest, "c".repeat(40));
validateMigrationRequest(migration, manifest, "c".repeat(40));
assert.throws(() => validateDeploymentRequest({ ...deployment, migration_0040_authorized: true }, manifest, "c".repeat(40)));
assert.throws(() => validateMigrationRequest({ ...migration, function_deployment_authorized: true }, manifest, "c".repeat(40)));
assert.throws(() => validateTrafficRequest({ schema: "s2_t281_chat_synthetic_traffic_request_v1" }, manifest, "c".repeat(40)), /STOP_S2_T281_AUTHORIZATION_FIELDS/);
assert.equal(manifest.accepted_dice_evidence_sha256, null);

for (const file of [
  "supabase/tests/s2-t281-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t281-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t281-chat-synthetic-traffic-request.schema.json",
  "supabase/tests/s2-t281-chat-post-window-disabled-receipt.schema.json",
]) assert.equal(json(file).additionalProperties, false);
const deploymentSchema = json("supabase/tests/s2-t281-chat-default-off-deployment-request.schema.json");
assert.equal(deploymentSchema.properties.migration_0040_authorized.const, false);
assert.equal(deploymentSchema.properties.traffic_authorized.const, false);
const migrationSchema = json("supabase/tests/s2-t281-chat-migration-0040-request.schema.json");
assert.equal(migrationSchema.properties.function_deployment_authorized.const, false);
const trafficSchema = json("supabase/tests/s2-t281-chat-synthetic-traffic-request.schema.json");
assert.deepEqual(trafficSchema.properties.runtime_request_fields.const, ["fixture_id"]);

const entry = read("apps/mobile/index.ts");
const screen = read("apps/mobile/src/dev/FounderCompanionChatJourney.tsx");
assert.match(entry, /__DEV__\s*&&\s*process\.env\.EXPO_PUBLIC_FOUNDER_COMPANION_CHAT === "1"/);
assert.match(screen, /offline preview|not run/);
assert.doesNotMatch(`${entry}\n${screen}`, /fetch\s*\(|createClient\s*\(|supabase\.from|chat-message|AZURE_OPENAI/i);
const web = read("scripts/start-s2-t281-founder-chat-web.sh");
const simulator = read("scripts/start-s2-t281-founder-chat-simulator.sh");
assert.match(web, /8151/);
assert.match(simulator, /8152/);
assert.doesNotMatch(`${web}\n${simulator}`, /814[0-6]|kill\s|pkill|killall|pnpm install|npm install/);
console.log(`S2_T281_CHAT_FINAL_REQUEST_CONTRACT_OK package=${binding}`);
