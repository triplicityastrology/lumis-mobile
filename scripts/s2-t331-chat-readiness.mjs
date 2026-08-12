#!/usr/bin/env node
import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync("config/s2-t331-chat-after-dice-root.json", "utf8"));
let next_action = control.next_action;
if (control.gates.accepted_corrected_dice_evidence_sha256) next_action = "WAITING_FOR_SEPARATE_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORITY";
if (control.gates.accepted_default_off_deployment_receipt_sha256) next_action = "WAITING_FOR_SEPARATE_CHAT_SYNTHETIC_TRAFFIC_AUTHORITY";
if (control.gates.accepted_synthetic_traffic_receipt_sha256) next_action = "SEPARATE_REVIEWED_SOURCE_ACTIVATION_REQUIRED";
console.log(JSON.stringify({
  status: "NOT_AUTHORIZED",
  next_action,
  normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY",
  provider_calls: 0,
  persistence_writes: 0,
  units_charged: 0,
}));
