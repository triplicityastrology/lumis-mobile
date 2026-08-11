import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = "config/s2-t270-chat-edge-final.json";
const sourceFiles = [
  ".env.example",
  "config/evidence/s2-t265-lumis-azure-foundry-deployment-readonly-v1.json",
  "config/evidence/s2-t265-microsoft-foundry-responses-v1-reference.json",
  "config/evidence/s2-t265-sanitized-api-route-family-v1.json",
  "config/evidence/s2-t265-sanitized-pricing-v1.json",
  "supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-v1.ts",
  "supabase/functions/_shared/chat-synthetic-integrated-authorization-v1.ts",
  "supabase/functions/_shared/chat-synthetic-postgres-authority-store-v1.ts",
  "supabase/functions/_shared/chat-synthetic-registry-v1.ts",
  "supabase/functions/_shared/chat-tokenizer-v1.ts",
  "supabase/functions/_shared/companion-synthetic-prompt-v1.ts",
  "supabase/functions/chat-synthetic/deno.json",
  "supabase/functions/chat-synthetic/edge-handler-v1.ts",
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/migrations/0040_chat_synthetic_authority_ledger.sql",
  "supabase/tests/s2-t193-normal-chat-contract-v1.schema.json",
  "supabase/tests/s2-t265-chat-authorization.schema.json",
  "supabase/tests/s2-t270-accepted-dice-technical-evidence.schema.json"
];

const sha = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(sourceFiles.map((file) => [file, sha(readFileSync(path.join(root, file)))]));
const manifest = {
  schema: "s2_t270_chat_edge_final_v1",
  task: "S2-T270",
  base_commit: "5efca3b1c0d734bfcf0c2357a2697e1ba9b4364f",
  statuses: ["SOURCE_COMPLETE", "LOCAL_EMULATOR_ONLY", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"],
  route: "chat-synthetic",
  gateway_interface: "chat_synthetic_gateway_port_v1",
  authority_store: "chat_synthetic_postgres_authority_store_v1",
  migration: "0040_chat_synthetic_authority_ledger.sql",
  tokenizer: { name: "o200k_base", package: "js-tiktoken", version: "1.0.21", deno_specifier: "npm:js-tiktoken@1.0.21" },
  accepted_t240_schema_sha256: "0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07",
  accepted_dice_gateway_package_sha256: "adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71",
  azure: {
    deployment_alias: "lumis-ai-chat-stg", model: "gpt-5-mini", model_version: "2025-08-07",
    deployment_type: "GlobalStandard", upgrade_policy: "NoAutoUpgrade", guardrail: "Microsoft.DefaultV2",
    hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com", route_family: "v1", api_version: null,
    input_usd_per_1m_tokens: 0.25, output_usd_per_1m_tokens: 2, evidence_retention_days: 30
  },
  configuration_names: [
    "LUMIS_CHAT_AI_ENABLED", "LUMIS_CHAT_AZURE_API_KEY", "LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256",
    "LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256", "LUMIS_CHAT_REVIEW_PACKAGE_SHA256",
    "LUMIS_CHAT_GATEWAY_SOURCE_SHA256", "LUMIS_CHAT_FIXTURE_REGISTRY_SHA256"
  ],
  execution: { deployment: false, provider_calls: 0, migration_applied: false, normal_chat_connected: false, member_persistence: false, units_charged: 0 },
  source_sha256: hashes
};
const packageBinding = sha(JSON.stringify(manifest));
const rendered = `${JSON.stringify({ ...manifest, package_binding_sha256: packageBinding }, null, 2)}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(path.join(root, output), rendered);
  console.log(`S2_T270_SEAL_WRITTEN ${packageBinding}`);
} else if (process.argv.includes("--check")) {
  if (readFileSync(path.join(root, output), "utf8") !== rendered) throw new Error("S2_T270_SOURCE_OR_PACKAGE_DRIFT");
  console.log(`S2_T270_SEAL_OK ${packageBinding}`);
} else {
  throw new Error("Use --write or --check");
}
