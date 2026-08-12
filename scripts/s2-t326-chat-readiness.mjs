import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync("config/s2-t326-chat-product-path.json", "utf8"));
const seal = JSON.parse(readFileSync("config/s2-t326-chat-product-path-seal.json", "utf8"));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const [path, expected] of Object.entries(seal.source_sha256)) {
  if (digest(path) !== expected) throw new Error("STOP_S2_T326_SOURCE_DRIFT");
}
let next_action = "SOURCE_PACKAGE_INVALID";
if (!control.dice_evidence.accepted_evidence_sha256) next_action = "WAITING_FOR_ACCEPTED_T317_DICE_TECHNICAL_EVIDENCE";
else if (!control.accepted_receipts.chat_default_off_deployment_sha256) next_action = "WAITING_FOR_SEPARATE_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORITY";
else if (!control.accepted_receipts.chat_synthetic_traffic_sha256) next_action = "WAITING_FOR_SEPARATE_CHAT_SYNTHETIC_TRAFFIC_AUTHORITY";
else next_action = "SEPARATE_REVIEWED_SOURCE_ACTIVATION_REQUIRED";
console.log(JSON.stringify({
  status: "NOT_AUTHORIZED",
  next_action,
  package_sha256: seal.package_sha256,
  normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY",
  provider_calls: 0,
  persistence_writes: 0,
  units_charged: 0
}));
