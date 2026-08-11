import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "apps/mobile/index.ts",
  "apps/mobile/src/dev/FounderCompanionChatJourney.tsx",
  "apps/mobile/src/dev/founderCompanionChatContract.ts",
  "apps/mobile/src/dev/founderCompanionChatWindowContract.ts",
  "apps/mobile/src/dev/founderCompanionChatWindowContract.fixtures.ts",
  "config/s2-t296-chat-operational-control.json",
  "config/evidence/s2-t296-chat-deno-runtime-proof.json",
  "docs/architecture/S2-T296-chat-operational-packet.md",
  "package.json",
  "scripts/lib/s2-t296-chat-operational.mjs",
  "scripts/s2-t276-chat-deno-runtime-proof.mjs",
  "scripts/s2-t296-chat-contract.mjs",
  "scripts/s2-t296-chat-operator.mjs",
  "scripts/s2-t296-chat-preflight.mjs",
  "scripts/s2-t296-chat-request.mjs",
  "scripts/s2-t296-chat-seal.mjs",
  "scripts/start-s2-t296-founder-chat-expo.sh",
  "scripts/start-s2-t296-founder-chat-simulator.sh",
  "scripts/start-s2-t296-founder-chat-web.sh",
  "supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-v1.ts",
  "supabase/functions/_shared/chat-synthetic-integrated-authorization-v1.ts",
  "supabase/functions/_shared/chat-synthetic-postgres-authority-store-v1.ts",
  "supabase/functions/_shared/chat-synthetic-registry-v1.ts",
  "supabase/functions/_shared/chat-tokenizer-v1.ts",
  "supabase/functions/chat-synthetic/deno.json",
  "supabase/functions/chat-synthetic/edge-handler-v1.ts",
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/migrations/0040_chat_synthetic_authority_ledger.sql",
  "supabase/tests/s2-t193-normal-chat-contract-v1.schema.json",
  "supabase/tests/s2-t296-accepted-dice-v4-evidence.schema.json",
  "supabase/tests/s2-t296-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t296-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t296-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t296-chat-migration-0040-authorization.schema.json",
  "supabase/tests/s2-t296-chat-synthetic-traffic-request.schema.json",
  "supabase/tests/s2-t296-chat-synthetic-traffic-authorization.schema.json"
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const control = JSON.parse(read("config/s2-t296-chat-operational-control.json"));
const source_sha256 = Object.fromEntries(files.map((file) => [file, sha(read(file))]));
const bound = {
  schema: "s2_t296_chat_operational_seal_v1",
  task: "S2-T296",
  base_commit: control.base_commit,
  project_ref: control.project_ref,
  function_name: control.function_name,
  gateway_interface: control.gateway_interface,
  canonical_t240_schema_sha256: control.canonical_t240_schema_sha256,
  approved_copy: control.approved_copy,
  dice_prerequisite: control.dice_prerequisite,
  accepted_dice_evidence_sha256: control.compiled_authorities.dice_technical_evidence_sha256,
  migration_0040_sha256: control.migration_0040_sha256,
  scopes: control.scopes,
  limits: control.limits,
  configuration_names: control.configuration_names,
  compiled_authorities: control.compiled_authorities,
  effects: control.effects,
  authority_status: control.authority_status,
  source_sha256
};
const sealed = { ...bound, package_binding_sha256: sha(JSON.stringify(bound)) };
const output = `${JSON.stringify(sealed, null, 2)}\n`;
const target = path.join(root, "config/s2-t296-chat-operational-seal.json");
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw new Error("STOP_S2_T296_SEAL_DRIFT");
  console.log(`S2_T296_CHAT_SEAL_OK package=${sealed.package_binding_sha256}`);
} else if (process.argv.includes("--write")) {
  writeFileSync(target, output, { mode: 0o644 });
  console.log(`S2_T296_CHAT_SEAL_WRITTEN package=${sealed.package_binding_sha256}`);
} else {
  throw new Error("STOP_S2_T296_SEAL_MODE");
}
