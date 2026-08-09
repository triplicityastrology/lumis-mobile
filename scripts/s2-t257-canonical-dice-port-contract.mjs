import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file));
const text = (file) => read(file).toString("utf8");
const json = (file) => JSON.parse(text(file));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const assert = (condition, code) => { if (!condition) throw new Error(code); };

const manifest = json("config/s2-t257-canonical-dice-gateway-manifest.json");
assert(manifest.schema === "s2_t257_canonical_dice_gateway_manifest_v1", "STOP_S2_T257_MANIFEST_SCHEMA");
assert(manifest.interface_version === "dice_synthetic_gateway_port_v1", "STOP_S2_T257_INTERFACE_DRIFT");
assert(manifest.authorization_schema === "lumis_dice_default_off_deployment_authorization_v2", "STOP_S2_T257_AUTH_SCHEMA_DRIFT");
assert(manifest.tokenizer.encoding === "o200k_base" && manifest.tokenizer.package === "js-tiktoken" && manifest.tokenizer.package_version === "1.0.21", "STOP_S2_T257_TOKENIZER_MANIFEST");
assert(manifest.authority_store.boundary === "postgres_atomic_rpc_v1" && manifest.authority_store.consume_rpc === "consume_lumis_dice_synthetic_authority_v1" && manifest.authority_store.access === "service_role_only_forced_rls" && manifest.authority_store.retention_days === 30, "STOP_S2_T257_AUTHORITY_STORE_MANIFEST");
assert(manifest.execution.technical_cases === 80 && manifest.execution.founder_cases === 0 && manifest.execution.founder_reserved_prohibited === 40, "STOP_S2_T257_EXECUTION_SCOPE");
assert(manifest.execution.max_provider_attempts === 160 && manifest.execution.concurrency === 2 && manifest.execution.eligible_retries === 1 && manifest.execution.shared_case_deadline_ms === 12000, "STOP_S2_T257_CAP_DRIFT");
assert(manifest.execution.max_input_tokens === 800 && manifest.execution.max_output_tokens === 300, "STOP_S2_T257_TOKEN_CAP_DRIFT");
assert(manifest.effects.normal_routes === 0 && manifest.effects.units_charged === 0 && manifest.effects.persistence_writes === 0 && manifest.effects.evidence_retention_days === 30, "STOP_S2_T257_EFFECT_DRIFT");

const packageFiles = Object.keys(manifest.package_files);
for (const file of packageFiles) {
  assert(sha256(read(file)) === manifest.package_files[file], `STOP_S2_T257_SOURCE_HASH_${file.replace(/\W/g, "_")}`);
}
const packagePayload = packageFiles.map((file) => `${file}\0${manifest.package_files[file]}`).join("\n");
assert(sha256(packagePayload) === manifest.package_sha256, "STOP_S2_T257_PACKAGE_SHA");
assert(sha256(read("supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts")) === manifest.fixture_registry_sha256, "STOP_S2_T257_REGISTRY_SHA");

const authorizationSchema = json("supabase/tests/lumis-dice-default-off-deployment-authorization-v2.schema.json");
const exactAuthorizationKeys = [
  "schema", "interface_version", "authorization_scope", "single_use_run_id", "issued_at", "valid_until",
  "gateway_package_sha256", "fixture_registry_sha256", "technical_case_count", "founder_execution",
  "authorization_hmac_sha256",
];
assert(authorizationSchema.$id === "lumis_dice_default_off_deployment_authorization_v2" && authorizationSchema.additionalProperties === false, "STOP_S2_T257_AUTH_SCHEMA_OPEN");
assert(JSON.stringify(authorizationSchema.required) === JSON.stringify(exactAuthorizationKeys), "STOP_S2_T257_AUTH_SCHEMA_KEYS");
assert(authorizationSchema.properties.technical_case_count.const === 80 && authorizationSchema.properties.founder_execution.const === false, "STOP_S2_T257_AUTH_SCOPE_OPEN");

const gatewaySource = text("supabase/functions/_shared/dice-synthetic-gateway-port-v1.ts");
const canonicalSource = text("supabase/functions/_shared/dice-synthetic-canonical-v1.ts");
const tokenizerSource = text("supabase/functions/_shared/dice-tokenizer-v1.ts");
const authorityStoreSource = text("supabase/functions/_shared/dice-authority-store-v1.ts");
const authorityMigration = text("supabase/migrations/0039_dice_synthetic_authority_ledger.sql");
const azureSource = text("supabase/functions/_shared/azure-dice-adapter-v1.ts");
const edgeSource = text("supabase/functions/dice-synthetic/index.ts");
const packageJson = json("package.json");
const lockfile = text("pnpm-lock.yaml");
assert(!gatewaySource.includes("Deno.serve") && !edgeSource.includes("dice-synthetic-gateway-port-v1"), "STOP_S2_T257_NORMAL_ROUTE_EXPOSURE");
assert(!gatewaySource.includes("consumedRunIds") && gatewaySource.includes("authorityStore.consume") && gatewaySource.includes("DICE_AUTHORITY_STORE_UNAVAILABLE"), "STOP_S2_T257_DURABLE_REPLAY_BYPASS");
assert(authorityStoreSource.includes('"consume_lumis_dice_synthetic_authority_v1"') && authorityStoreSource.includes("p_gateway_package_sha256") && authorityStoreSource.includes("p_fixture_registry_sha256") && authorityStoreSource.includes("p_issued_at") && authorityStoreSource.includes("p_valid_until"), "STOP_S2_T257_RPC_BINDING");
assert(/run_id text primary key/i.test(authorityMigration) && /on conflict \(run_id\) do nothing/i.test(authorityMigration), "STOP_S2_T257_ATOMIC_CONSUME");
assert(/security definer/i.test(authorityMigration) && /auth\.role\(\) is distinct from 'service_role'/i.test(authorityMigration) && /force row level security/i.test(authorityMigration), "STOP_S2_T257_SERVICE_ROLE_RLS");
assert(/revoke all on table public\.lumis_dice_synthetic_authority_ledger from public, anon, authenticated, service_role/i.test(authorityMigration) && /grant execute on function public\.consume_lumis_dice_synthetic_authority_v1[\s\S]+to service_role/i.test(authorityMigration), "STOP_S2_T257_LEDGER_GRANTS");
assert(/interval '30 days'/i.test(authorityMigration) && /purge_lumis_dice_synthetic_authority_ledger_v1/i.test(authorityMigration) && /cron\.schedule\([\s\S]+lumis-dice-authority-retention[\s\S]+\*\/15 \* \* \* \*/i.test(authorityMigration), "STOP_S2_T257_LEDGER_RETENTION");
const ledgerColumns = authorityMigration.slice(authorityMigration.indexOf("create table"), authorityMigration.indexOf(");") + 2);
for (const forbiddenColumn of ["prompt", "response", "question", "member", "user_id", "provider_payload"]) assert(!ledgerColumns.includes(forbiddenColumn), `STOP_S2_T257_LEDGER_FORBIDDEN_${forbiddenColumn}`);
assert(!gatewaySource.includes("estimateTokens") && gatewaySource.includes("measureDiceTokenLimit"), "STOP_S2_T257_TOKENIZER_BYPASS");
assert(tokenizerSource.includes('getEncoding(DICE_TOKENIZER_VERSION)') && tokenizerSource.includes('"o200k_base"') && !tokenizerSource.includes("TextEncoder"), "STOP_S2_T257_TOKENIZER_IMPLEMENTATION");
assert(packageJson.devDependencies["js-tiktoken"] === "1.0.21", "STOP_S2_T257_TOKENIZER_DEPENDENCY");
assert(lockfile.includes("js-tiktoken@1.0.21:") && lockfile.includes("sha512-biOj/6M5qdgx5TKjDnFT1ymSpM5tbd3ylwDtrQvFQSu0Z7bBYko2dF+W/aUkXUPuk6IVpRxk/3Q2sHOzGlS36g=="), "STOP_S2_T257_TOKENIZER_LOCK");
assert(canonicalSource.includes("technicalCases: 80") && canonicalSource.includes("founderCasesExecutable: 0") && canonicalSource.includes("providerAttempts: 160"), "STOP_S2_T257_CANONICAL_LIMITS");
assert(azureSource.includes("2024-10-21") && !azureSource.includes("AZURE_OPENAI_API_VERSION") && azureSource.includes(".openai\\.azure\\.com"), "STOP_S2_T257_AZURE_BOUNDARY");
for (const forbidden of ["supabase.from", ".insert(", ".update(", "chargeUnits", "normal chat", "member_id", "user_id", "birth_date"]) {
  assert(!gatewaySource.includes(forbidden), `STOP_S2_T257_FORBIDDEN_${forbidden.replace(/\W/g, "_")}`);
}

console.log(`S2_T257_CANONICAL_DICE_PORT_OK package_sha256=${manifest.package_sha256} registry_sha256=${manifest.fixture_registry_sha256}`);
