import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync(new URL("../config/s2-t306-normal-chat-integration-candidate.json", import.meta.url), "utf8"));
assert.equal(control.integration_enabled, false);
assert.equal(control.traffic_enabled, false);
assert.equal(control.normal_chat_route_connected, false);
assert.equal(control.accepted_dice_evidence_sha256, null);
assert.equal(control.accepted_chat_authority_sha256, null);
assert.equal(control.authority_status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.authority_status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

console.log("status=SOURCE_CANDIDATE_DISABLED");
console.log("next_action=WAITING_FOR_ACCEPTED_DICE_EVIDENCE_AND_CHAT_AUTHORITY");
console.log("normal_chat=NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
console.log("azure_traffic=NO_AZURE_TRAFFIC_AUTHORITY");
