import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { STOP, createReviewPackage, evaluateKillCriteria, guardGateway, loadControl, validateRatings, validateReviewPackage } from "./lib/s2-t304-dice-80-results.mjs";

const read = (path) => readFileSync(path, "utf8");
const { control, registry } = loadControl();
assert.equal(control.deployment_authority.canonical_commit, "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432");
assert.equal(control.deployment_authority.zero_call_package_commit, "69c3de399acf3fa9ec746deaeb7a1880128955ca");
assert.equal(control.deployment_authority.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(control.migration_boundary.proof_receipt_sha256, "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e");
assert.deepEqual(control.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(registry.fixtures.length, 80);
assert.equal(registry.fixtures.filter((item) => item.language === "en").length, 40);
assert.equal(registry.fixtures.filter((item) => item.language === "zh-Hant").length, 40);

const missing = spawnSync(process.execPath, ["scripts/s2-t304-dice-80-results.mjs", "preflight"], { encoding: "utf8" });
assert.equal(missing.status, 2);
assert.equal(JSON.parse(missing.stdout).status, "WAITING_FOR_ACCEPTED_DICE_V4_POST_DEPLOY_DISABLED_RECEIPT");
assert.equal(JSON.parse(missing.stdout).remote_calls, 0);
const emulator = execFileSync(process.execPath, ["scripts/s2-t304-dice-80-results-emulator.mjs"], { encoding: "utf8" });
assert.match(emulator, /cases=80 en=40 zh_hant=40/);
assert.match(emulator, /concurrency=2/);
assert.match(emulator, /provider_disabled=true remote_calls=0/);

const ratings = registry.fixtures.map((fixture) => ({ fixture_id: fixture.fixture_id, authority: 5, relevance: 5, tone: 5, language_quality: 5, safety: 5 }));
assert.equal(validateRatings(ratings, registry).length, 80);
assert.throws(() => validateRatings(ratings.slice(1), registry), (error) => error.code === STOP.ratings);
assert.throws(() => validateRatings([{ ...ratings[0], prompt: "forbidden" }, ...ratings.slice(1)], registry), (error) => error.code === STOP.ratings);

const observed = new Date().toISOString();
const evidence = (fixture, failure = "none") => ({ schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id: "dice-tech80-t304contract0001", fixture_id: fixture.fixture_id, phase: "technical", language: fixture.language, result_class: "completed", attempt_count: 1, input_tokens: 400, output_tokens: 150, duration_ms: 100, concurrency_peak: 2, redacted_failure_code: failure, observed_at: observed, retain_until: new Date(Date.parse(observed) + 30 * 86_400_000).toISOString(), effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 } });
const journal = { schema: "s2_t294_dice_technical_run_journal_v1", run_id: "dice-tech80-t304contract0001", state: "completed", created_at: observed, updated_at: observed, kill_requested: false, provider_disabled_verified: true, records: registry.fixtures.map((fixture, index) => ({ fixture_id: fixture.fixture_id, language: fixture.language, state: "completed", attempts: [{ attempt_id: `attempt-${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`, ordinal: 1, state: "completed", reserved_at: observed, completed_at: observed, evidence: evidence(fixture) }] })) };
assert.equal(evaluateKillCriteria(journal, control), null);
const timeoutJournal = structuredClone(journal); timeoutJournal.records[0].attempts[0].evidence.redacted_failure_code = "provider_timeout";
assert.equal(evaluateKillCriteria(timeoutJournal, control), STOP.deadline);
const inputJournal = structuredClone(journal); inputJournal.records[0].attempts[0].evidence.input_tokens = 801;
assert.equal(evaluateKillCriteria(inputJournal, control), STOP.input);
const outputJournal = structuredClone(journal); outputJournal.records[0].attempts[0].evidence.output_tokens = 301;
assert.equal(evaluateKillCriteria(outputJournal, control), STOP.output);
const rateJournal = structuredClone(journal); rateJournal.records[0].attempts[0].evidence.redacted_failure_code = "provider_rate_limited";
assert.equal(evaluateKillCriteria(rateJournal, control), STOP.rate);
const unavailableJournal = structuredClone(journal); unavailableJournal.records[0].attempts[0].evidence.redacted_failure_code = "provider_unavailable";
assert.equal(evaluateKillCriteria(unavailableJournal, control), STOP.unavailable);
const malformedJournal = structuredClone(journal); malformedJournal.records[0].attempts[0].evidence.redacted_failure_code = "provider_malformed";
assert.equal(evaluateKillCriteria(malformedJournal, control), STOP.malformed);
const budgetJournal = structuredClone(journal); budgetJournal.records[0].attempts[0].evidence.attempt_count = 3;
assert.equal(evaluateKillCriteria(budgetJournal, control), STOP.budget);
const disabledJournal = structuredClone(journal); disabledJournal.provider_disabled_verified = false;
assert.equal(evaluateKillCriteria(disabledJournal, control), STOP.disable);
const guarded = guardGateway({
  async status() { return {}; },
  async disable() {},
  async executeFixture() { return evidence(registry.fixtures[0], "provider_unavailable"); }
});
await assert.rejects(() => guarded.executeFixture({}), (error) => error.code === STOP.unavailable);
const review = createReviewPackage(journal, control, ratings, "contract_fixture");
assert.equal(review.rows.length, 80); assert.equal(review.summary.meets_bar, 80); assert.equal(review.live_azure_proof, false);
assert.equal(validateReviewPackage(review).rows.length, 80);
assert.throws(() => validateReviewPackage({ ...review, unknown: true }), (error) => error.code === STOP.review);
const mismatched = structuredClone(review); mismatched.rows[0].fixture_id = mismatched.rows[1].fixture_id;
assert.throws(() => validateReviewPackage(mismatched), (error) => error.code === STOP.review);
assert(!/[\"'](?:prompt|response|question|member_id|account_id|device_id|endpoint|api_key|secret|raw_error)[\"']\s*:/.test(JSON.stringify(review).toLowerCase()));

for (const path of ["supabase/tests/s2-t304-dice-technical-results-review.schema.json", "supabase/tests/s2-t304-zero-network-rehearsal-receipt.schema.json"]) assert.equal(JSON.parse(read(path)).additionalProperties, false);
const manifest = JSON.parse(read("config/s2-t304-dice-80-results-manifest.json"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const packageInput = Object.entries(manifest.files).map(([path, expected]) => { const actual = sha(readFileSync(path)); assert.equal(actual, expected, `sealed drift: ${path}`); return `${path}:${actual}\n`; }).join("");
assert.equal(sha(packageInput), manifest.package_sha256);
assert.equal(manifest.local_rehearsal_is_live_proof, false);
console.log("S2_T304_DICE_80_RESULTS_CONTRACT_OK cases=80 en=40 zh_hant=40 attempts=160_max concurrency=2 remote_calls=0");
