#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync("config/s2-t336-chat-after-dice-product.json", "utf8"));
assert.equal(control.candidate.integration_enabled, false);
assert.equal(control.candidate.traffic_enabled, false);
assert.equal(control.final_dice_evidence.accepted_evidence_sha256, null);
assert.equal(control.authority.normal_member_activation, false);
assert.equal(control.authority.provider, false);
assert.equal(control.authority.deployment, false);
assert.equal(control.authority.public_route, false);
console.log("S2_T336_CHAT_READINESS_BLOCKED disabled=true accepted_final_dice_sha=null normal_chat_authority=false provider_authority=false");
