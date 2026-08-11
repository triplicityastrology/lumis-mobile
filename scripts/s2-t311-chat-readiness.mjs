import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync("config/s2-t311-chat-release-candidate.json", "utf8"));
const digests = [
  control.accepted_dice_evidence_sha256,
  control.accepted_deployment_receipt_sha256,
  control.accepted_traffic_receipt_sha256,
];

let next = "WAITING_FOR_ACCEPTED_DICE_TECHNICAL_EVIDENCE";
if (digests[0]) next = "WAITING_FOR_SEPARATE_CHAT_DEFAULT_OFF_DEPLOYMENT_RECEIPT";
if (digests[0] && digests[1]) next = "WAITING_FOR_SEPARATE_CHAT_SYNTHETIC_TRAFFIC_AUTHORITY";
if (digests.every((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))) {
  next = "SOURCE_CHANGE_REQUIRED_TO_ENABLE_CHAT_RELEASE_CANDIDATE";
}

console.log(JSON.stringify({
  status: "NOT_AUTHORIZED",
  next_action: next,
  normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY",
  provider_calls: 0,
  persistence_writes: 0,
  units_charged: 0,
}));
