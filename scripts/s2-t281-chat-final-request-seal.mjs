import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = "config/s2-t281-chat-final-request-seal.json";
const sourceFiles = [
  "apps/mobile/index.ts",
  "apps/mobile/src/dev/FounderCompanionChatJourney.tsx",
  "apps/mobile/src/dev/founderCompanionChatContract.ts",
  "apps/mobile/src/dev/founderCompanionChatWindowContract.fixtures.ts",
  "apps/mobile/src/dev/founderCompanionChatWindowContract.ts",
  "apps/mobile/src/types/env.d.ts",
  "apps/mobile/tsconfig.founder-companion-chat-window-test.json",
  "config/evidence/s2-t276-chat-deno-runtime-proof.json",
  "config/s2-t270-chat-edge-final.json",
  "config/s2-t276-chat-runtime-review.json",
  "config/s2-t281-chat-final-request.json",
  "docs/architecture/S2-T270-final-chat-edge-candidate.md",
  "docs/architecture/S2-T281-chat-final-request-package.md",
  "docs/qa/S2-T271-founder-companion-chat-window.md",
  "package.json",
  "scripts/lib/s2-t281-chat-final-request.mjs",
  "scripts/s2-t270-chat-edge-contract.mjs",
  "scripts/s2-t270-chat-edge-seal.mjs",
  "scripts/s2-t276-chat-runtime-seal.mjs",
  "scripts/s2-t281-chat-final-request.mjs",
  "scripts/s2-t281-chat-final-request-contract.mjs",
  "scripts/s2-t281-chat-final-request-seal.mjs",
  "scripts/s2-t281-founder-chat-window-contract.mjs",
  "scripts/s2-t281-founder-chat-window-schema-contract.mjs",
  "scripts/start-s2-t281-founder-chat-simulator.sh",
  "scripts/start-s2-t281-founder-chat-web.sh",
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
  "supabase/tests/s2-t270-accepted-dice-technical-evidence.schema.json",
  "supabase/tests/s2-t271-dice-technical-evidence.schema.json",
  "supabase/tests/s2-t271-founder-chat-post-window-disabled.schema.json",
  "supabase/tests/s2-t271-founder-chat-window-authorization-request.schema.json",
  "supabase/tests/s2-t271-founder-chat-window-control.json",
  "supabase/tests/s2-t271-founder-chat-window-execution-evidence.schema.json",
  "supabase/tests/s2-t271-founder-chat-window-verdict.schema.json",
  "supabase/tests/s2-t276-chat-default-off-deployment-receipt.schema.json",
  "supabase/tests/s2-t276-chat-rollback-receipt.schema.json",
  "supabase/tests/s2-t281-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t281-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t281-chat-post-window-disabled-receipt.schema.json",
  "supabase/tests/s2-t281-chat-synthetic-traffic-request.schema.json"
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sourceSha256 = Object.fromEntries(sourceFiles.map((file) => [file, sha(readFileSync(path.join(root, file)))]));
const control = JSON.parse(readFileSync(path.join(root, "config/s2-t281-chat-final-request.json"), "utf8"));
const manifest = {
  schema: "s2_t281_chat_final_request_seal_v1",
  task: "S2-T281",
  base_commit: control.base_commit,
  founder_interface_commit: control.founder_interface_commit,
  statuses: control.statuses,
  project_ref: control.project_ref,
  function_name: control.function_name,
  gateway_interface: control.gateway_interface,
  canonical_t240_schema_sha256: control.canonical_t240_schema_sha256,
  dice_prerequisite: control.dice_prerequisite,
  accepted_dice_evidence_sha256: control.dice_prerequisite.accepted_evidence_sha256,
  migration_0040_sha256: sourceSha256["supabase/migrations/0040_chat_synthetic_authority_ledger.sql"],
  scopes: control.scopes,
  runtime_proof: { deno: "2.2.12", disabled_probes: 4, disabled_code: "CHAT_AI_DISABLED", provider_calls: 0 },
  effects: { deployment_executed: false, migration_applied: false, traffic_executed: false, model_invocations: 0, normal_chat_connected: false, persistence_writes: 0, units_charged: 0 },
  source_sha256: sourceSha256
};
const rendered = `${JSON.stringify({ ...manifest, package_binding_sha256: sha(JSON.stringify(manifest)) }, null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(path.join(root, output), rendered);
  console.log("S2_T281_CHAT_FINAL_REQUEST_SEAL_WRITTEN");
} else if (process.argv.includes("--check")) {
  if (readFileSync(path.join(root, output), "utf8") !== rendered) throw new Error("STOP_S2_T281_PACKAGE_DRIFT");
  console.log("S2_T281_CHAT_FINAL_REQUEST_SEAL_OK");
} else throw new Error("Use --write or --check");
