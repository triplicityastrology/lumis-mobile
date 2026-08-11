import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const control = JSON.parse(readFileSync(path.join(root, "config/s2-t286-chat-deploy-test-final.json"), "utf8"));
const sourceFiles = [
  "apps/mobile/index.ts",
  "apps/mobile/src/dev/FounderCompanionChatJourney.tsx",
  "apps/mobile/src/dev/founderCompanionChatContract.ts",
  "apps/mobile/src/dev/founderCompanionChatWindowContract.fixtures.ts",
  "apps/mobile/src/dev/founderCompanionChatWindowContract.ts",
  "config/evidence/s2-t276-chat-deno-runtime-proof.json",
  "config/s2-t276-chat-runtime.json",
  "config/s2-t286-chat-deploy-test-final.json",
  "docs/architecture/S2-T286-chat-deploy-test-final.md",
  "package.json",
  "scripts/lib/s2-t286-chat-authority.mjs",
  "scripts/run-s2-t286-chat-deployment.zsh",
  "scripts/s2-t276-chat-deno-runtime-proof.mjs",
  "scripts/s2-t286-chat-contract.mjs",
  "scripts/s2-t286-chat-readiness.mjs",
  "scripts/s2-t286-chat-seal.mjs",
  "scripts/start-s2-t286-founder-chat-simulator.sh",
  "scripts/start-s2-t286-founder-chat-web.sh",
  "supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.fixtures.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-v1.ts",
  "supabase/functions/_shared/chat-synthetic-integrated-authorization-v1.fixtures.ts",
  "supabase/functions/_shared/chat-synthetic-integrated-authorization-v1.ts",
  "supabase/functions/_shared/chat-synthetic-postgres-authority-store-v1.ts",
  "supabase/functions/_shared/chat-tokenizer-v1.ts",
  "supabase/functions/chat-synthetic/deno.json",
  "supabase/functions/chat-synthetic/edge-handler-v1.fixtures.ts",
  "supabase/functions/chat-synthetic/edge-handler-v1.ts",
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/migrations/0040_chat_synthetic_authority_ledger.sql",
  "supabase/tests/s2-t193-normal-chat-contract-v1.schema.json",
  "supabase/tests/s2-t286-chat-default-off-deployment-receipt.schema.json",
  "supabase/tests/s2-t286-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t286-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t286-chat-post-window-disabled-receipt.schema.json",
  "supabase/tests/s2-t286-chat-synthetic-traffic-request.schema.json",
  "supabase/tests/s2-t286-dice-technical-evidence-acceptance.schema.json"
  ,"supabase/tests/s2-t286-founder-chat-verdict.schema.json"
];
const source_sha256 = Object.fromEntries(sourceFiles.map((file) => [file, sha(readFileSync(path.join(root, file)))]));
const manifest = {
  schema: "s2_t286_chat_deploy_test_final_seal_v1",
  task: "S2-T286",
  base_commit: control.base_commit,
  statuses: control.statuses,
  project_ref: control.project_ref,
  function_name: control.function_name,
  gateway_interface: control.gateway_interface,
  canonical_t240_schema_sha256: control.canonical_t240_schema_sha256,
  dice_prerequisite: control.dice_prerequisite,
  accepted_dice_evidence_sha256: null,
  migration_0040_sha256: source_sha256["supabase/migrations/0040_chat_synthetic_authority_ledger.sql"],
  scopes: control.scopes,
  runtime_proof: { deno: "2.2.12", disabled_probes: 4, disabled_code: "CHAT_AI_DISABLED", provider_calls: 0, model_invocations: 0 },
  effects: {
    deployment_executed: false, migration_applied: false, traffic_executed: false,
    model_invocations: 0, normal_chat_connected: false, member_context: false,
    threads: false, messages: false, persistence_writes: 0, units_charged: 0
  },
  source_sha256
};
const sealed = { ...manifest, package_binding_sha256: sha(JSON.stringify(manifest)) };
const output = `${JSON.stringify(sealed, null, 2)}\n`;
const target = path.join(root, "config/s2-t286-chat-deploy-test-final-seal.json");
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw new Error("STOP_S2_T286_SEAL_DRIFT");
  console.log(`S2_T286_CHAT_SEAL_OK package=${sealed.package_binding_sha256}`);
} else {
  writeFileSync(target, output);
  console.log(`S2_T286_CHAT_SEAL_WRITTEN package=${sealed.package_binding_sha256}`);
}
