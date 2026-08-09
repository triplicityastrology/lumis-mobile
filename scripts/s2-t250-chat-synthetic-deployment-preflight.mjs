import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const files = [
  "supabase/functions/chat-synthetic/index.ts",
  "supabase/functions/_shared/chat-synthetic-gateway-v1.ts",
  "supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts",
  "supabase/functions/_shared/cors.ts"
];
const hashes = Object.fromEntries(files.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));
const requested = process.argv.includes("--execute");
const exactFalse = process.env.LUMIS_AI_ENABLED === "false";

console.log(JSON.stringify({
  status: requested ? "STOP_S2_T250_REMOTE_EXECUTION_NOT_AUTHORIZED" : "READY_FOR_TECHNICAL_REVIEW_DEFAULT_OFF",
  route: "chat-synthetic",
  source_hashes: hashes,
  lumis_ai_enabled_classification: exactFalse ? "verified_false_in_process" : "not_supplied",
  model_calls: 0,
  deployment_performed: false,
  authority: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]
}, null, 2));

if (requested || !exactFalse) process.exitCode = 2;
