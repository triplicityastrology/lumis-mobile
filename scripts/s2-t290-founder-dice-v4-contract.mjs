import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const boundary = read("apps/mobile/src/dev/founderDiceV4WindowContract.ts");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const manifest = json("config/s2-t290-founder-dice-v4-manifest.json");
const requestSchema = json("config/s2-t290-founder-window-authorization-request.schema.json");
const receiptSchema = json("config/s2-t290-founder-window-authorization-receipt.schema.json");
const web = read("scripts/start-s2-t290-founder-dice-web.sh");
const simulator = read("scripts/start-s2-t290-founder-dice-simulator.sh");
const expo = read("scripts/start-s2-t290-founder-dice-expo.sh");

assert.equal(manifest.fixture_counts.total, 40);
assert.equal(manifest.fixture_counts.en, 20);
assert.equal(manifest.fixture_counts["zh-Hant"], 20);
assert.equal(manifest.eligibility.deployment_authorization_schema, "lumis_dice_default_off_function_deployment_authorization_v4");
assert.equal(manifest.eligibility.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(manifest.eligibility.technical_evidence_schema, "s2_t289_dice_technical_window_evidence_v1");
assert.equal(manifest.eligibility.checked_in_acceptance_digests, 0);
assert.equal(manifest.founder_receipt_design_authority.status, "APPROVED_AS_DESIGN_ONLY");
for (const key of ["operational_authority_granted", "deployment_authorized", "migration_authorized", "azure_traffic_authorized", "normal_chat_authorized", "member_data_authorized", "public_use_authorized"]) assert.equal(manifest.founder_receipt_design_authority[key], false);
assert.equal(manifest.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

assert.match(boundary, /T287_AUTHORIZATION_SCHEMA = "lumis_dice_default_off_function_deployment_authorization_v4"/);
assert.match(boundary, /T287_RUNTIME_PACKAGE_SHA256 = "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457"/);
assert.match(boundary, /TECHNICAL_EVIDENCE_SCHEMA = "s2_t289_dice_technical_window_evidence_v1"/);
assert.match(boundary, /ACCEPTED_RUNTIME_ENVELOPE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_TECHNICAL_EVIDENCE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256: string \| null = null/);
assert.doesNotMatch(boundary, /(?:question|question_text)\s*:/, "runtime contract must not send question text");

assert.match(consoleSource, /from "\.\/founderDiceV4WindowContract"/);
assert.doesNotMatch(consoleSource, /from "\.\/founderDiceWindowContract"/);
assert.match(consoleSource, /CURRENT NEXT ACTION/);
assert.match(consoleSource, /Download rating sheet/);
assert.match(consoleSource, /Download verdict package/);
assert.doesNotMatch(consoleSource, /horizontal[\s\S]{0,100}Founder fixture slots/);
assert.match(consoleSource, /slotGrid: \{ flexDirection: "row", flexWrap: "wrap"/);
assert.match(consoleSource, /fixtureGrid: \{ flexDirection: "row", flexWrap: "wrap"/);
assert.match(consoleSource, /ratingButtons: \{ flexDirection: "row", flexWrap: "wrap"/);

assert.equal(requestSchema.additionalProperties, false);
assert.equal(requestSchema.properties.fixture_total.const, 40);
assert.equal(requestSchema.properties.language_totals.properties.en.const, 20);
assert.equal(requestSchema.properties.runtime_package_sha256.const, manifest.eligibility.runtime_package_sha256);
assert.equal(receiptSchema.additionalProperties, false);
assert.equal(receiptSchema.properties.signature_algorithm.const, "Ed25519");
assert.equal(receiptSchema.properties.invocation_shape.const, "fixture_id_only");

for (const [source, port, marker] of [[web, "8157", "--dev"], [simulator, "8158", "expo start"], [expo, "8159", "--lan"]]) {
  assert.match(source, new RegExp(port));
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /git status --porcelain --untracked-files=no/);
  assert.match(source, /PORT_(?:OCCUPIED|OWNED)/);
  assert.doesNotMatch(source, /kill -9|pkill|killall/);
}
for (const protectedPort of ["8124", "8125", ...Array.from({ length: 15 }, (_, index) => String(8140 + index))]) {
  assert.doesNotMatch(`${web}\n${simulator}\n${expo}`, new RegExp(`--port [\"']?${protectedPort}(?:\\D|$)`));
}

console.log("S2-T290 Founder Dice v4 source contract passed");
