import {
  COMPANION_FIXTURE_IDS,
  RATING_DIMENSIONS,
  type CompanionRatings,
} from "./founderCompanionChatContract";
import {
  ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256,
  ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256,
  ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256,
  ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256,
  FINAL_DICE_DEPLOYMENT_EVIDENCE_SCHEMA,
  FINAL_DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA,
  FINAL_DICE_TECHNICAL_EVIDENCE_SCHEMA,
  FINAL_DICE_TECHNICAL_PACKAGE_SCHEMA,
  FINAL_DICE_TECHNICAL_AUTHORITY,
  FOUNDER_CHAT_FIXTURE_SETS,
  WINDOW_PREVIEW_RECORDS,
  createAuthorizedFixtureInvocation,
  createChatWindowAuthorizationRequest,
  createFounderWindowVerdict,
  importAcceptedWindowExecution,
  inspectDiceTechnicalEvidence,
  inspectPostWindowDisabledProof,
  parseEmbeddedWindowRecord,
  surfaceForFixture,
} from "./founderCompanionChatWindowContract";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

check(FOUNDER_CHAT_FIXTURE_SETS.companion.length === 30, "30 Companion fixtures");
check(FOUNDER_CHAT_FIXTURE_SETS.normal_chat.length === 30, "30 normal Chat fixtures");
check(new Set([...FOUNDER_CHAT_FIXTURE_SETS.companion, ...FOUNDER_CHAT_FIXTURE_SETS.normal_chat]).size === 60, "sets partition registry");
check(COMPANION_FIXTURE_IDS.every((id) => FOUNDER_CHAT_FIXTURE_SETS[surfaceForFixture(id)].includes(id)), "every fixture has one review surface");
check(WINDOW_PREVIEW_RECORDS.every(({ state }) => state === "offline_preview" || state === "not_yet_run"), "embedded states never claim live");
check(new Set(WINDOW_PREVIEW_RECORDS.map(({ surface }) => surface)).size === 2, "both surfaces have preview records");

const structurallyValidDiceEvidence = {
  schema: FINAL_DICE_TECHNICAL_EVIDENCE_SCHEMA,
  review_decision: "accepted",
  deployment_receipt: {
    schema: FINAL_DICE_DEPLOYMENT_EVIDENCE_SCHEMA,
    authorization_schema: FINAL_DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA,
    project_ref: "bmqhwofmdgebpcihjlnb", function_name: "dice-synthetic", deployment_id: "dice-deploy-example00000001",
    source_commit: "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432", runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
    disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
    provider_calls: 0, model_invocations: 0, kill_switch_disabled: true, traffic_switch_disabled: true, migration_applied: false,
    deployed_at: "2026-08-11T09:00:00.000Z", valid_until: "2026-08-11T13:00:00.000Z",
  },
  technical_evidence: {
    schema: FINAL_DICE_TECHNICAL_PACKAGE_SCHEMA, run_id: "dice-tech80-example000001", deployment_id: "dice-deploy-example00000001",
    runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
    migration_proof_receipt_sha256: "c".repeat(64), registry_sha256: "d".repeat(64), technical_case_count: 80, founder_case_count: 0,
    language: { en: 40, "zh-Hant": 40 }, attempt_total: 96, concurrency_peak: 2, tokenizer: "js-tiktoken@1.0.21/o200k_base", cost_ceiling_usd: 0.128,
    provider_disabled_verified: true,
    effects: { provider_calls: 96, model_invocations: 96, persistence_writes: 0, units_charged: 0, finally_disabled: true, post_window_disabled_proof_sha256: "e".repeat(64) },
    records: Array.from({ length: 80 }, (_, index) => ({ fixture_id: `technical-${index + 1}` })),
  },
  accepted_at: "2026-08-11T12:00:00.000Z",
};
const inspection = inspectDiceTechnicalEvidence(structurallyValidDiceEvidence, "a".repeat(64));
check(inspection.structurally_valid && !inspection.accepted && inspection.code === "DICE_EVIDENCE_VALID_NOT_ACCEPTED", "valid self-authored evidence cannot become accepted");
for (const hostile of [
  { ...structurallyValidDiceEvidence, account_id: "forbidden" },
  { ...structurallyValidDiceEvidence, technical_evidence: { ...structurallyValidDiceEvidence.technical_evidence, technical_case_count: 79 } },
  { ...structurallyValidDiceEvidence, technical_evidence: { ...structurallyValidDiceEvidence.technical_evidence, provider_disabled_verified: false } },
  { ...structurallyValidDiceEvidence, deployment_receipt: { ...structurallyValidDiceEvidence.deployment_receipt, source_commit: "0".repeat(40) } },
  { ...structurallyValidDiceEvidence, technical_evidence: { ...structurallyValidDiceEvidence.technical_evidence, effects: { ...structurallyValidDiceEvidence.technical_evidence.effects, units_charged: 1 } } },
]) check(!inspectDiceTechnicalEvidence(hostile, "a".repeat(64)).structurally_valid, "hostile Dice evidence rejected");

check(ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256 === null, "no accepted Dice evidence compiled");
check(ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256 === null, "no Chat window authorization compiled");
check(ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256 === null, "no execution evidence compiled");
check(ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256 === null, "no disabled proof compiled");

let authorizationBlocked = false;
try { createChatWindowAuthorizationRequest({ buildSha: "b".repeat(40), acceptedDiceEvidenceSha256: "a".repeat(64), fixtureExportSha256: "c".repeat(64) }); } catch { authorizationBlocked = true; }
check(authorizationBlocked, "authorization request blocked without compiled Dice evidence");

for (const invocation of [
  { fixture_id: "chat_en_small_decision_v1" },
  { fixture_id: "chat_en_small_decision_v1", question: "runtime text forbidden" },
]) {
  let rejected = false;
  try { createAuthorizedFixtureInvocation(invocation, "d".repeat(64)); } catch { rejected = true; }
  check(rejected, "runtime invocation remains ID-only and authority-gated");
}

for (const record of WINDOW_PREVIEW_RECORDS) parseEmbeddedWindowRecord(record);
for (const hostile of [
  { ...WINDOW_PREVIEW_RECORDS[0], state: "live_synthetic" },
  { ...WINDOW_PREVIEW_RECORDS[0], surface: "normal_chat" },
  { ...WINDOW_PREVIEW_RECORDS[0], units_charged: 1 },
  { ...WINDOW_PREVIEW_RECORDS[0], persistence_writes: 1 },
  { ...WINDOW_PREVIEW_RECORDS[0], provider_diagnostics: "raw" },
  { ...WINDOW_PREVIEW_RECORDS[0], member_id: "forbidden" },
]) {
  let rejected = false;
  try { parseEmbeddedWindowRecord(hostile); } catch { rejected = true; }
  check(rejected, "hostile embedded record rejected");
}

let fabricatedExecutionRejected = false;
try {
  importAcceptedWindowExecution({ schema_version: "founder_chat_window_execution_evidence_v4", evidence_sha256: "e".repeat(64), authorization_sha256: "d".repeat(64), status: "accepted", response: { ...WINDOW_PREVIEW_RECORDS[0], state: "live_synthetic" } }, "e".repeat(64));
} catch { fabricatedExecutionRejected = true; }
check(fabricatedExecutionRejected, "self-authored live execution rejected");

const disabledProof = { schema_version: "founder_chat_post_window_disabled_v1", authorization_sha256: "d".repeat(64), execution_evidence_sha256: "e".repeat(64), status: "disabled", provider_enabled: false, residual_access: false, provider_calls_after_disable: 0, checked_at_bucket: "same_controlled_window" };
check(!inspectPostWindowDisabledProof(disabledProof, "f".repeat(64)).accepted, "self-authored disabled proof rejected");

const ratings = Object.fromEntries(RATING_DIMENSIONS.map((dimension) => [dimension, 3])) as CompanionRatings;
const verdict = createFounderWindowVerdict({
  buildSha: "b".repeat(40), fixtureExportSha256: "c".repeat(64), acceptedExecutionEvidenceSha256: null, postWindowDisabledProofSha256: null,
  entries: WINDOW_PREVIEW_RECORDS.map((record) => ({ fixture_id: record.fixture_id, language: record.language, surface: record.surface, ratings, verdict: "pending" })),
});
check(verdict.entries.length === 4 && verdict.authority_status.azure_traffic === "NO_AZURE_TRAFFIC_AUTHORITY", "offline verdict is closed and truthful");

console.log("S2-T271 Founder Companion/Chat window fixtures passed");
