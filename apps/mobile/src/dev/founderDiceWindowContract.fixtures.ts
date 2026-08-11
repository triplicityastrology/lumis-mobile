import {
  ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256,
  ACCEPTED_RUNTIME_ENVELOPE_SHA256,
  ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
  T272_RUNTIME_COMMIT,
  T272_RUNTIME_PROOF_SHA256,
  T274_LEDGER_PROOF_RECEIPT_SHA256,
  authorizationRequestCanonicalJson,
  createFounderInvocation,
  createFounderWindowAuthorizationRequest,
  parseFounderExecutionEvidence,
  parseFounderWindowAuthorizationReceipt,
  parsePostWindowProof,
  parseRuntimePackageAcceptance,
  parseTechnicalEvidenceImport,
} from "./founderDiceWindowContract";
import { RESERVED_DICE_FOUNDER_IDS, freezeFounderDiceDraft, validateFounderDiceDraft } from "./founderAiReviewContract";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rejected(action: () => unknown, message: string): void {
  let didReject = false;
  try { action(); } catch { didReject = true; }
  check(didReject, message);
}

const runtimeEnvelopeSha = "a".repeat(64);
const technicalEvidenceSha = "b".repeat(64);
const requestSha = "c".repeat(64);
const founderReceiptSha = "d".repeat(64);
const executionSha = "e".repeat(64);
const finalPackageSha = "f".repeat(64);

const runtimeEnvelope = {
  schema_version: "s2_t280_dice_runtime_package_acceptance_v1",
  status: "accepted",
  interface_version: "dice_synthetic_gateway_port_v1",
  runtime_source_commit: T272_RUNTIME_COMMIT,
  runtime_proof_sha256: T272_RUNTIME_PROOF_SHA256,
  final_release_commit: "1".repeat(40),
  final_package_sha256: finalPackageSha,
  deployment_receipt_sha256: "2".repeat(64),
  function_name: "dice-synthetic",
  deployment_scope: "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY",
  migration_0039_in_scope: false,
  provider_disabled_verified: true,
  provider_calls: 0,
  model_invocations: 0,
} as const;

check(ACCEPTED_RUNTIME_ENVELOPE_SHA256 === null, "runtime package is not self-accepted");
check(ACCEPTED_TECHNICAL_EVIDENCE_SHA256 === null, "technical evidence is not self-accepted");
check(ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256 === null, "Founder window is not self-authorized");
rejected(() => parseRuntimePackageAcceptance(JSON.stringify(runtimeEnvelope), runtimeEnvelopeSha), "default build rejects a pasted runtime envelope");
for (const hostile of [
  { ...runtimeEnvelope, runtime_source_commit: "0".repeat(40) },
  { ...runtimeEnvelope, migration_0039_in_scope: true },
  { ...runtimeEnvelope, provider_disabled_verified: false },
  { ...runtimeEnvelope, provider_calls: 1 },
  { ...runtimeEnvelope, endpoint: "forbidden" },
]) rejected(() => parseRuntimePackageAcceptance(JSON.stringify(hostile), runtimeEnvelopeSha, runtimeEnvelopeSha), "runtime drift or unknown fields fail closed");
const acceptedRuntime = parseRuntimePackageAcceptance(JSON.stringify(runtimeEnvelope), runtimeEnvelopeSha, runtimeEnvelopeSha);

const technical = {
  schema_version: "s2_t280_dice_technical_evidence_acceptance_v1",
  status: "accepted",
  phase: "technical_80_only",
  runtime_package_sha256: finalPackageSha,
  runtime_acceptance_sha256: runtimeEnvelopeSha,
  technical_evidence_package_sha256: "3".repeat(64),
  ledger_proof_receipt_sha256: T274_LEDGER_PROOF_RECEIPT_SHA256,
  registry_checksum: "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030",
  logical_total: 80,
  language_totals: { en: 40, "zh-Hant": 40 },
  founder_cases: 0,
  partial: false,
  provider_disabled_verified: true,
  post_window_disabled_receipt_sha256: "4".repeat(64),
  effects: { member_data: 0, persistence_writes: 0, units_charged: 0 },
} as const;

rejected(() => parseTechnicalEvidenceImport(JSON.stringify(technical), technicalEvidenceSha, acceptedRuntime, runtimeEnvelopeSha), "default build rejects self-authored technical evidence");
for (const hostile of [
  { ...technical, logical_total: 79 },
  { ...technical, language_totals: { en: 39, "zh-Hant": 40 } },
  { ...technical, founder_cases: 1 },
  { ...technical, partial: true },
  { ...technical, provider_disabled_verified: false },
  { ...technical, ledger_proof_receipt_sha256: "5".repeat(64) },
  { ...technical, runtime_package_sha256: "6".repeat(64) },
  { ...technical, raw_response: "forbidden" },
]) rejected(() => parseTechnicalEvidenceImport(JSON.stringify(hostile), technicalEvidenceSha, acceptedRuntime, runtimeEnvelopeSha, technicalEvidenceSha), "partial, stale, Founder-bearing, or private evidence fails closed");
const acceptedTechnical = parseTechnicalEvidenceImport(JSON.stringify(technical), technicalEvidenceSha, acceptedRuntime, runtimeEnvelopeSha, technicalEvidenceSha);

const fixtures = RESERVED_DICE_FOUNDER_IDS.map((fixtureId) => {
  const language = fixtureId.includes("-ZH-") ? "zh-Hant" : "en";
  const question = language === "en" ? `What should I notice about decision ${fixtureId.slice(-2)}?` : `關於選擇${fixtureId.slice(-2)}，有什麼值得我留意？`;
  const decision = validateFounderDiceDraft(question, language);
  const frozen = freezeFounderDiceDraft(fixtureId, decision);
  check(frozen, `fixture must freeze: ${fixtureId}`);
  return frozen;
});

const request = createFounderWindowAuthorizationRequest({
  runtime: acceptedRuntime,
  runtimeAcceptanceSha256: runtimeEnvelopeSha,
  technicalEvidence: acceptedTechnical,
  technicalEvidenceSha256: technicalEvidenceSha,
  founderFixturePackageSha256: "7".repeat(64),
  fixtures,
});
check(request.fixture_total === 40 && request.language_totals.en === 20 && request.language_totals["zh-Hant"] === 20, "authorization request is exactly 20/20");
check(!authorizationRequestCanonicalJson(request).includes(fixtures[0].question), "authorization request excludes question text");

const founderReceipt = {
  schema_version: "s2_t280_founder_window_authorization_receipt_v1",
  status: "accepted",
  authorization_scope: "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY",
  request_sha256: requestSha,
  runtime_package_sha256: finalPackageSha,
  technical_evidence_sha256: technicalEvidenceSha,
  fixture_package_sha256: "7".repeat(64),
  fixture_total: 40,
  language_totals: { en: 20, "zh-Hant": 20 },
  single_use_window_id: "dice-founder40-abcdefghijklmnop",
  valid_until: "2026-08-12T00:00:00.000Z",
  invocation_shape: "fixture_id_only",
} as const;
rejected(() => parseFounderWindowAuthorizationReceipt(JSON.stringify(founderReceipt), founderReceiptSha, requestSha, request), "pasted Founder receipt is not authority");
for (const hostile of [
  { ...founderReceipt, fixture_total: 39 },
  { ...founderReceipt, language_totals: { en: 19, "zh-Hant": 20 } },
  { ...founderReceipt, request_sha256: "8".repeat(64) },
  { ...founderReceipt, invocation_shape: "question_text" },
  { ...founderReceipt, secret: "forbidden" },
]) rejected(() => parseFounderWindowAuthorizationReceipt(JSON.stringify(hostile), founderReceiptSha, requestSha, request, founderReceiptSha), "Founder receipt drift fails closed");
const acceptedFounderReceipt = parseFounderWindowAuthorizationReceipt(JSON.stringify(founderReceipt), founderReceiptSha, requestSha, request, founderReceiptSha);
check(Object.keys(createFounderInvocation("DICE-FOUNDER-EN-01", acceptedFounderReceipt)).join(",") === "fixture_id", "runtime request is fixture ID only");
rejected(() => createFounderInvocation("DICE-TECH-EN-JUDGMENT-01", acceptedFounderReceipt), "Technical fixture cannot enter Founder window");

const execution = {
  schema_version: "s2_t280_founder_execution_evidence_v1",
  runtime_package_sha256: finalPackageSha,
  technical_evidence_sha256: technicalEvidenceSha,
  founder_authorization_receipt_sha256: founderReceiptSha,
  fixture_id: "DICE-FOUNDER-EN-01",
  language: "en",
  state: "live_synthetic",
  result_class: "completed",
  safe_rendered_output: "A bounded synthetic interpretation.",
  attempt_count: 1,
  latency_bucket: "under_3s",
  input_token_bucket: "0_to_400",
  output_token_bucket: "0_to_150",
  effects: { persistence_writes: 0, units_charged: 0 },
} as const;
rejected(() => parseFounderExecutionEvidence(JSON.stringify(execution), executionSha, execution.fixture_id, acceptedRuntime, technicalEvidenceSha, founderReceiptSha), "live result is unavailable without accepted execution evidence");
const acceptedExecution = parseFounderExecutionEvidence(JSON.stringify(execution), executionSha, execution.fixture_id, acceptedRuntime, technicalEvidenceSha, founderReceiptSha, executionSha);
check(acceptedExecution.safe_rendered_output.includes("bounded"), "safe interpretation projects after the full chain validates");
for (const hostile of [
  { ...execution, fixture_id: "DICE-FOUNDER-ZH-01" },
  { ...execution, safe_rendered_output: "" },
  { ...execution, state: "loading" },
  { ...execution, input_token_bucket: "801_to_1200" },
  { ...execution, effects: { persistence_writes: 1, units_charged: 0 } },
  { ...execution, raw_provider_response: "forbidden" },
]) rejected(() => parseFounderExecutionEvidence(JSON.stringify(hostile), executionSha, execution.fixture_id, acceptedRuntime, technicalEvidenceSha, founderReceiptSha, executionSha), "unsafe or mismatched execution evidence fails closed");

const postWindow = {
  schema_version: "s2_t280_founder_post_window_disabled_v1",
  runtime_package_sha256: finalPackageSha,
  founder_authorization_receipt_sha256: founderReceiptSha,
  gateway_enabled: false,
  provider_access: false,
  founder_window_closed: true,
  provider_disabled_verified: true,
  provider_calls_after_close: 0,
  evidence_sha256: "9".repeat(64),
} as const;
check(parsePostWindowProof(JSON.stringify(postWindow), finalPackageSha, founderReceiptSha).provider_disabled_verified, "closed post-window proof verifies disabled state");
rejected(() => parsePostWindowProof(JSON.stringify({ ...postWindow, provider_access: true }), finalPackageSha, founderReceiptSha), "residual provider access fails closed");
rejected(() => parsePostWindowProof(JSON.stringify({ ...postWindow, provider_calls_after_close: 1 }), finalPackageSha, founderReceiptSha), "post-close call fails closed");

console.log("S2-T280 final Founder Dice window fixtures passed");
