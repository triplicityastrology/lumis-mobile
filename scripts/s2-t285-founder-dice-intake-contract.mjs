import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const source = read("apps/mobile/src/dev/founderDiceIntakeContract.ts");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const freezer = read("scripts/s2-t285-freeze-founder-dice-intake.mjs");
const web = read("scripts/start-s2-t285-founder-dice-intake-web.sh");
const simulator = read("scripts/start-s2-t285-founder-dice-intake-simulator.sh");
const manifest = JSON.parse(read("config/s2-t285-founder-dice-intake-manifest.json"));
const intakeSchema = JSON.parse(read("config/s2-t285-founder-dice-intake.schema.json"));
const ratingSchema = JSON.parse(read("config/s2-t285-founder-dice-rating-sheet.schema.json"));

for (const marker of ["EXACTLY_40", "QUESTION_PRIVATE_DATA", "WAITING_FOR_ACCEPTED_80_EVIDENCE", "WAITING_FOR_FOUNDER_WINDOW_RECEIPT", 'runtime_request_fields: Object.freeze(["fixture_id"]']) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
for (const state of ["validation", "loading", "interpretation", "safety", "fallback"]) assert.match(consoleSource, new RegExp(`id: \\"${state}\\"|${state}`));
assert.match(consoleSource, /FOUNDER_INTAKE_STATES/);
assert.match(consoleSource, /createFounderRatingSheet/);
assert.doesNotMatch(`${source}\n${consoleSource}`, /fetch\s*\(|createClient\s*\(|supabase\.from|DiceHistorySheet|Past Rolls|sessionRollsRef|AZURE_/i);
assert.match(freezer, /runtime_request_fields: \["fixture_id"\]/);
assert.doesNotMatch(freezer, /fetch\s*\(|https\.request|createClient|AzureOpenAI|SUPABASE_URL/i);
assert.match(web, /FOUNDER_DICE_INTAKE_WEB_PORT:-8153/);
assert.match(web, /expo export --platform web --dev --clear/);
assert.match(simulator, /FOUNDER_DICE_INTAKE_SIMULATOR_PORT:-8154/);
assert.doesNotMatch(`${web}\n${simulator}`, /kill\s|pkill|killall|pnpm install|npm install/);
assert.equal(manifest.base_commit, "98649f346b3ffafec3dc8412f53eaea4256a8608");
assert.deepEqual(manifest.fixture_counts, { total: 40, en: 20, "zh-Hant": 20 });
assert.deepEqual(manifest.runtime_request_fields, ["fixture_id"]);
assert.equal(manifest.effects.provider_calls, 0);
assert.equal(manifest.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(intakeSchema.additionalProperties, false);
assert.equal(intakeSchema.properties.fixtures.minItems, 40);
assert.equal(ratingSchema.additionalProperties, false);
assert.equal(ratingSchema.properties.rows.minItems, 40);

const fixtures = Array.from({ length: 40 }, (_, index) => {
  const language = index < 20 ? "en" : "zh-Hant";
  const ordinal = index < 20 ? index + 1 : index - 19;
  const fixture_id = `DICE-FOUNDER-${language === "en" ? "EN" : "ZH"}-${String(ordinal).padStart(2, "0")}`;
  const question = language === "en" ? `Should I notice a distinct practical signal for choice ${ordinal}?` : `在選擇${ordinal}中，我應該留意哪個不同的實際訊號？`;
  return { fixture_id, language, question, question_sha256: sha256(question), expected_route: "judgment", review_status: "locally_frozen_pending_review" };
});
const payload = { schema_version: "s2_t285_founder_dice_intake_v1", build_sha: "a".repeat(40), registry_interface: "dice-synthetic-registry-v0.3.0", registry_checksum: "b".repeat(64), fixture_total: 40, language_totals: { en: 20, "zh-Hant": 20 }, runtime_request_fields: ["fixture_id"], authority_required: { accepted_technical_80_evidence: true, separate_founder_window_receipt: true }, fixtures, effects: { provider_calls: 0, persistence_writes: 0, units_charged: 0 } };
const envelope = { payload, sha256: sha256(canonical(payload)) };
const run = (value) => spawnSync(process.execPath, ["scripts/s2-t285-freeze-founder-dice-intake.mjs"], { input: JSON.stringify(value), encoding: "utf8" });
const accepted = run(envelope);
assert.equal(accepted.status, 0, accepted.stderr);
const frozen = JSON.parse(accepted.stdout);
assert.equal(frozen.payload.fixture_total, 40);
assert.deepEqual(frozen.payload.runtime_request_fields, ["fixture_id"]);
assert.equal(frozen.payload.effects.provider_calls, 0);
for (const hostile of [
  { ...envelope, extra: true },
  { ...envelope, sha256: "c".repeat(64) },
  { payload: { ...payload, fixtures: fixtures.slice(0, 39), fixture_total: 39 }, sha256: "d".repeat(64) },
  { payload: { ...payload, runtime_request_fields: ["fixture_id", "question"] }, sha256: "e".repeat(64) },
]) assert.notEqual(run(hostile).status, 0);

console.log("S2-T285 Founder Dice intake source and server-freeze contracts passed");
