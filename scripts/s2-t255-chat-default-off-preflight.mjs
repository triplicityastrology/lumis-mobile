import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const execute = process.argv.includes("--execute");
const enabled = process.env.LUMIS_AI_ENABLED;
const credentialNamesPresent = [
  "SUPABASE_ACCESS_TOKEN",
  "AZURE_FOUNDRY_CHAT_KEY",
  "CHAT_SYNTHETIC_RUN_TOKEN"
].filter((name) => typeof process.env[name] === "string" && process.env[name].length > 0);
const authorizationPresent = process.env.S2_T255_DEPLOY_AUTHORITY_RECEIPT === "reviewed-default-off-v1";
const files = [
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-v1.ts",
  "supabase/functions/_shared/chat-synthetic-registry-v1.ts",
  "supabase/functions/_shared/companion-synthetic-prompt-v1.ts",
  "supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts"
];
const hashes = Object.fromEntries(files.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));

let status = "READY_FOR_TECHNICAL_REVIEW_DEFAULT_OFF";
if (execute && !authorizationPresent) status = "STOP_S2_T255_DEPLOYMENT_AUTHORITY_UNAVAILABLE";
else if (execute && enabled !== "false") status = "STOP_S2_T255_DISABLED_CONFIGURATION_UNVERIFIED";
else if (execute && credentialNamesPresent.length === 0) status = "STOP_S2_T255_DEPLOYMENT_CREDENTIAL_UNAVAILABLE";
else if (execute) status = "STOP_S2_T255_REMOTE_EXECUTION_REQUIRES_SEPARATE_OPERATOR_REVIEW";

console.log(JSON.stringify({
  status,
  route: "chat-synthetic",
  source_hashes: hashes,
  lumis_ai_enabled_classification: enabled === "false" ? "verified_false_in_process" : "not_verified_false",
  credential_name_count: credentialNamesPresent.length,
  authorization_receipt_classification: authorizationPresent ? "present" : "absent",
  deployment_performed: false,
  model_calls: 0,
  authority: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]
}, null, 2));

if (execute || enabled !== "false") process.exitCode = 2;
