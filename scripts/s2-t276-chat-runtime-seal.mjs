import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = "config/s2-t276-chat-runtime-review.json";
const sourceFiles = [
  ".gitignore",
  ".env.example",
  "config/evidence/s2-t276-chat-deno-runtime-proof.json",
  "config/s2-t265-microsoft-chat-manifest.json",
  "config/s2-t270-chat-edge-final.json",
  "config/s2-t276-chat-runtime.json",
  "docs/architecture/S2-T276-chat-runtime-readiness.md",
  "package.json",
  "scripts/run-s2-t276-chat-deployment.zsh",
  "scripts/s2-t276-chat-deno-runtime-proof.mjs",
  "scripts/s2-t276-chat-readiness.mjs",
  "scripts/s2-t276-chat-operator-contract.mjs",
  "scripts/s2-t276-chat-runtime-contract.mjs",
  "scripts/s2-t276-chat-runtime-seal.mjs",
  "scripts/s2-t270-chat-edge-seal.mjs",
  "supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/chat-synthetic-postgres-authority-store-v1.ts",
  "supabase/functions/chat-synthetic/deno.json",
  "supabase/functions/chat-synthetic/edge-handler-v1.ts",
  "supabase/functions/chat-synthetic/edge-handler-v1.fixtures.ts",
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/migrations/0040_chat_synthetic_authority_ledger.sql",
  "supabase/tests/s2-t193-normal-chat-contract-v1.schema.json",
  "supabase/tests/s2-t270-accepted-dice-technical-evidence.schema.json",
  "supabase/tests/s2-t276-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t276-chat-default-off-deployment-receipt.schema.json",
  "supabase/tests/s2-t276-chat-rollback-receipt.schema.json",
  "supabase/tests/s2-t276-founder-chat-fixture-bridge.schema.json"
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sourceSha256 = Object.fromEntries(sourceFiles.map((file) => [file, sha(readFileSync(path.join(root, file)))]));
const manifest = {
  schema: "s2_t276_chat_runtime_review_v1",
  task: "S2-T276",
  base_commit: "f9567f8280cc377f09e4584d5ac4b0d18cc205fe",
  statuses: ["SOURCE_READY", "LOCAL_DENO_RUNTIME_PROVED", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"],
  route: "chat-synthetic",
  project_ref: "bmqhwofmdgebpcihjlnb",
  gateway_interface: "chat_synthetic_gateway_port_v1",
  founder_bridge_interface: "s2_t276_founder_chat_fixture_bridge_v1",
  documented_founder_interface: "s2_t271_founder_chat_window_v1",
  runtime: { deno: "2.2.12", tokenizer: "npm:js-tiktoken@1.0.21", supabase_js: "npm:@supabase/supabase-js@2.110.2" },
  kill_switch: { name: "LUMIS_CHAT_AI_ENABLED", default: false, disabled_code: "CHAT_AI_DISABLED", probes: 4 },
  accepted_dice_runtime_commit: "f5f9e9da238633d84eb8695307c573eef8f1bc96",
  accepted_dice_runtime_control_sha256: "b8d22c7c4677e654a83764f5499ddecb9bc97f327e115205ffd13848b5537be1",
  accepted_dice_runtime_proof_sha256: "3f44ef8c674ae70037f1e34ffde9f0efb70862ee1bc4b158cadbeae50efe1256",
  accepted_dice_technical_authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  accepted_t240_schema_sha256: "0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07",
  deployment: { executed: false, provider_calls: 0, migration_0040_applied: false, normal_chat_connected: false, member_data: false, persistence_writes: 0, units_charged: 0 },
  future_gate: "MICROSOFT_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION_REQUIRED",
  source_sha256: sourceSha256
};
const rendered = `${JSON.stringify({ ...manifest, package_binding_sha256: sha(JSON.stringify(manifest)) }, null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(path.join(root, output), rendered);
  console.log("S2_T276_CHAT_RUNTIME_SEAL_WRITTEN");
} else if (process.argv.includes("--check")) {
  if (readFileSync(path.join(root, output), "utf8") !== rendered) throw new Error("S2_T276_CHAT_RUNTIME_PACKAGE_DRIFT");
  console.log("S2_T276_CHAT_RUNTIME_SEAL_OK");
} else throw new Error("Use --write or --check");
