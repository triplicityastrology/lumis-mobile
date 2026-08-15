#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MOBILE_DICE_REQUEST_KEYS, projectMobileDiceUpstream, validateMobileDiceRelayRequest } from "./lib/founder-mobile-dice-relay.mjs";

const fixtures = new Set(["dice-founder-en-10", "dice-founder-zh-08"]);
const valid = { fixture_id: "dice-founder-en-10", planet_id: "venus", sign_id: "leo", house_id: "house_6" };
assert.deepEqual(MOBILE_DICE_REQUEST_KEYS, ["fixture_id", "planet_id", "sign_id", "house_id"]);
assert.equal(validateMobileDiceRelayRequest(valid, fixtures), true);
for (const hostile of [
  { ...valid, fixture_id: "dice-founder-en-99" },
  { ...valid, planet_id: "chiron" },
  { ...valid, sign_id: "ophiuchus" },
  { ...valid, house_id: "house_13" },
  { ...valid, question: "forbidden" },
]) assert.equal(validateMobileDiceRelayRequest(hostile, fixtures), false);

const result = { schema: "lumis_dice_v0_3_result_v2", language: "en" };
assert.deepEqual(projectMobileDiceUpstream(200, { result, metadata: { fixture_id: valid.fixture_id } }, valid.fixture_id), { status: 200, body: result });
assert.equal(projectMobileDiceUpstream(422, { error: { code: "DICE_FIXED_FALLBACK", redacted_failure_code: "safe" } }, valid.fixture_id).body.result, "fixed_fallback");
assert.equal(projectMobileDiceUpstream(422, { error: { code: "DICE_SAFETY_REDIRECT" } }, "dice-founder-zh-08").body.language, "zh-Hant");
assert.deepEqual(projectMobileDiceUpstream(401, { raw: "forbidden" }, valid.fixture_id), { status: 502, body: { error: "DICE_GATEWAY_UNAVAILABLE" } });

const relay = readFileSync("scripts/founder-mobile-dice-relay.mjs", "utf8");
assert.match(relay, /x-lumis-founder-window-authorization/);
assert.match(relay, /AbortSignal\.timeout\(12_000\)/);
assert.match(relay, /TRUSTED_SPKI_SHA256/);
assert.match(relay, /be92814f6a466fdd56f0fd1e86fd10d5277dbd78/);
assert.match(relay, /420cfb312d1c6a5973584def1a912a5182bff6edf3f831feae51a20e70543d0a/);
assert.match(relay, /receipt\.source_commit !== ACCEPTED_T348_SOURCE_COMMIT/);
assert.match(relay, /receipt\.lab_package_sha256 !== ACCEPTED_T348_PACKAGE_SHA256/);
assert.doesNotMatch(relay, /console\.(?:log|error)|process\.stdout\.write\([^)]*(?:receipt|anonKey|publicKey|payload)/i);
console.log("Founder Mobile Dice relay contract passed");
