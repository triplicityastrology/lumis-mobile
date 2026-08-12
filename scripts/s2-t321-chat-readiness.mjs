import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync("config/s2-t321-chat-post-dice-release-candidate.json", "utf8"));
const dice = control.final_dice_evidence;
let next_action = "SOURCE_PACKAGE_BINDING_INVALID";
if (dice.accepted_source_commit && dice.accepted_source_tree && dice.accepted_release_package_sha256 && dice.accepted_release_manifest_sha256 && !dice.accepted_evidence_sha256) {
  next_action = "WAITING_FOR_ACCEPTED_T317_DICE_TECHNICAL_EVIDENCE";
} else if (dice.accepted_evidence_sha256 && !control.accepted_digests.chat_deployment_receipt_sha256) {
  next_action = "WAITING_FOR_SEPARATE_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORITY";
} else if (control.accepted_digests.chat_deployment_receipt_sha256 && !control.accepted_digests.chat_traffic_receipt_sha256) {
  next_action = "WAITING_FOR_SEPARATE_CHAT_SYNTHETIC_TRAFFIC_AUTHORITY";
} else if (control.accepted_digests.chat_traffic_receipt_sha256) {
  next_action = "SEPARATE_REVIEWED_SOURCE_ACTIVATION_REQUIRED";
}
console.log(JSON.stringify({
  status: "NOT_AUTHORIZED",
  next_action,
  normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY",
  provider_calls: 0,
  persistence_writes: 0,
  units_charged: 0
}));
