import { RESERVED_DICE_FOUNDER_IDS, freezeFounderDiceDraft, validateFounderDiceDraft } from "./founderAiReviewContract";
import {
  ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256,
  ACCEPTED_RUNTIME_ENVELOPE_SHA256,
  ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
  T287_RUNTIME_PACKAGE_SHA256,
  authorizationRequestCanonicalJson,
  createFounderInvocation,
  createFounderWindowAuthorizationRequest,
  parseFounderExecutionEvidence,
  parseFounderWindowAuthorizationReceipt,
  parsePostWindowProof,
  parseRuntimePackageAcceptance,
  parseTechnicalEvidenceImport,
  resolveFounderNextAction,
} from "./founderDiceV4WindowContract";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function rejects(fn: () => unknown, message: string): void {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  check(rejected, message);
}

const deploymentSha = "a".repeat(64);
const technicalSha = "b".repeat(64);
const requestSha = "c".repeat(64);
const founderSha = "d".repeat(64);
const executionSha = "e".repeat(64);
const probes = {
  unknown_fixture: "DICE_AI_DISABLED",
  free_form_body: "DICE_AI_DISABLED",
  normal_mobile_body: "DICE_AI_DISABLED",
  allow_listed_fixture: "DICE_AI_DISABLED",
} as const;
const deployment = {
  schema: "s2_t287_dice_default_off_deployment_receipt_v1",
  status: "accepted",
  authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  project_ref: "bmqhwofmdgebpcihjlnb",
  function_name: "dice-synthetic",
  source_commit: "1".repeat(40),
  source_tree: "2".repeat(40),
  runtime_package_sha256: T287_RUNTIME_PACKAGE_SHA256,
  deployment_receipt_sha256: "3".repeat(64),
  authorization_sha256: "4".repeat(64),
  configuration_names_verified: true,
  disabled_probes: probes,
  provider_disabled_verified: true,
  provider_calls: 0,
  model_invocations: 0,
  migration_0039_applied: false,
} as const;

check(ACCEPTED_RUNTIME_ENVELOPE_SHA256 === null && ACCEPTED_TECHNICAL_EVIDENCE_SHA256 === null && ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256 === null, "checked-in source has no accepted live authority");
rejects(() => parseRuntimePackageAcceptance(JSON.stringify(deployment), deploymentSha), "local deployment envelope cannot self-authorize");
for (const hostile of [
  { ...deployment, authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v3" },
  { ...deployment, runtime_package_sha256: "0".repeat(64) },
  { ...deployment, disabled_probes: { ...probes, allow_listed_fixture: "OK" } },
  { ...deployment, provider_calls: 1 },
  { ...deployment, migration_0039_applied: true },
  { ...deployment, endpoint: "forbidden" },
]) rejects(() => parseRuntimePackageAcceptance(JSON.stringify(hostile), deploymentSha, deploymentSha), "deployment drift fails closed");
const acceptedDeployment = parseRuntimePackageAcceptance(JSON.stringify(deployment), deploymentSha, deploymentSha);

const technical = {
  schema: "s2_t289_dice_technical_window_evidence_v1",
  status: "accepted",
  phase: "technical_80_only",
  deployment_receipt_sha256: deploymentSha,
  runtime_package_sha256: T287_RUNTIME_PACKAGE_SHA256,
  migration_receipt_sha256: "5".repeat(64),
  technical_evidence_package_sha256: "6".repeat(64),
  registry_checksum: "7".repeat(64),
  logical_total: 80,
  language_totals: { en: 40, "zh-Hant": 40 },
  founder_cases: 0,
  partial: false,
  provider_disabled_verified: true,
  post_window_disabled_receipt_sha256: "8".repeat(64),
  effects: { member_data: 0, persistence_writes: 0, units_charged: 0 },
} as const;
rejects(() => parseTechnicalEvidenceImport(JSON.stringify(technical), technicalSha, acceptedDeployment, deploymentSha), "local Technical envelope cannot self-authorize");
for (const hostile of [
  { ...technical, logical_total: 79 },
  { ...technical, language_totals: { en: 40, "zh-Hant": 39 } },
  { ...technical, founder_cases: 1 },
  { ...technical, partial: true },
  { ...technical, deployment_receipt_sha256: "9".repeat(64) },
  { ...technical, raw_response: "forbidden" },
]) rejects(() => parseTechnicalEvidenceImport(JSON.stringify(hostile), technicalSha, acceptedDeployment, deploymentSha, technicalSha), "Technical evidence drift fails closed");
const acceptedTechnical = parseTechnicalEvidenceImport(JSON.stringify(technical), technicalSha, acceptedDeployment, deploymentSha, technicalSha);

const fixtures = RESERVED_DICE_FOUNDER_IDS.map((fixtureId) => {
  const language = fixtureId.includes("-ZH-") ? "zh-Hant" : "en";
  const question = language === "en" ? `What should I notice about decision ${fixtureId.slice(-2)}?` : `關於選擇${fixtureId.slice(-2)}，有什麼值得我留意？`;
  const frozen = freezeFounderDiceDraft(fixtureId, validateFounderDiceDraft(question, language));
  check(frozen, `fixture must freeze: ${fixtureId}`);
  return frozen;
});
const request = createFounderWindowAuthorizationRequest({
  runtime: acceptedDeployment,
  runtimeAcceptanceSha256: deploymentSha,
  technicalEvidence: acceptedTechnical,
  technicalEvidenceSha256: technicalSha,
  founderFixturePackageSha256: "f".repeat(64),
  fixtures,
});
check(request.fixture_total === 40 && request.language_totals.en === 20 && request.language_totals["zh-Hant"] === 20, "request is exact 20/20");
check(!authorizationRequestCanonicalJson(request).includes(fixtures[0].question), "request excludes question text");

const founderReceipt = {
  schema: "lumis_dice_founder_window_authorization_v1",
  issuer: "Microsoft",
  decision: "AUTHORIZED",
  authorization_scope: "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY",
  request_sha256: requestSha,
  runtime_package_sha256: T287_RUNTIME_PACKAGE_SHA256,
  technical_evidence_sha256: technicalSha,
  fixture_package_sha256: "f".repeat(64),
  fixture_total: 40,
  language_totals: { en: 20, "zh-Hant": 20 },
  single_use_window_id: "dice-founder40-abcdefghijklmnop",
  issued_at: "2026-08-11T10:00:00.000Z",
  valid_until: "2026-08-11T10:15:00.000Z",
  invocation_shape: "fixture_id_only",
  signature_algorithm: "Ed25519",
  microsoft_signature_base64: "A".repeat(88),
} as const;
rejects(() => parseFounderWindowAuthorizationReceipt(JSON.stringify(founderReceipt), founderSha, requestSha, request), "local Founder receipt cannot self-authorize");
for (const hostile of [
  { ...founderReceipt, valid_until: "2026-08-11T10:15:01.000Z" },
  { ...founderReceipt, fixture_total: 39 },
  { ...founderReceipt, invocation_shape: "question_text" },
  { ...founderReceipt, secret: "forbidden" },
]) rejects(() => parseFounderWindowAuthorizationReceipt(JSON.stringify(hostile), founderSha, requestSha, request, founderSha), "Founder receipt drift fails closed");
const acceptedFounder = parseFounderWindowAuthorizationReceipt(JSON.stringify(founderReceipt), founderSha, requestSha, request, founderSha);
check(Object.keys(createFounderInvocation("DICE-FOUNDER-EN-01", acceptedFounder)).join(",") === "fixture_id", "runtime accepts fixture ID only");

const execution = {
  schema: "s2_t290_founder_execution_evidence_v1",
  runtime_package_sha256: T287_RUNTIME_PACKAGE_SHA256,
  technical_evidence_sha256: technicalSha,
  founder_authorization_receipt_sha256: founderSha,
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
rejects(() => parseFounderExecutionEvidence(JSON.stringify(execution), executionSha, execution.fixture_id, acceptedDeployment, technicalSha, founderSha), "result requires accepted evidence digest");
check(parseFounderExecutionEvidence(JSON.stringify(execution), executionSha, execution.fixture_id, acceptedDeployment, technicalSha, founderSha, executionSha).state === "live_synthetic", "accepted live evidence projects safely");

const post = {
  schema: "s2_t290_founder_post_window_disabled_v1",
  runtime_package_sha256: T287_RUNTIME_PACKAGE_SHA256,
  founder_authorization_receipt_sha256: founderSha,
  gateway_enabled: false,
  provider_access: false,
  founder_window_closed: true,
  provider_disabled_verified: true,
  provider_calls_after_close: 0,
  evidence_sha256: "9".repeat(64),
} as const;
check(parsePostWindowProof(JSON.stringify(post), T287_RUNTIME_PACKAGE_SHA256, founderSha).founder_window_closed, "post-window proof closes the run");
rejects(() => parsePostWindowProof(JSON.stringify({ ...post, provider_access: true }), T287_RUNTIME_PACKAGE_SHA256, founderSha), "residual provider access rejected");

check(resolveFounderNextAction({ deploymentAccepted: false, technicalAccepted: false, frozenCount: 0, founderAuthorized: false }).includes("v4"), "first next action is deployment receipt");
check(resolveFounderNextAction({ deploymentAccepted: true, technicalAccepted: true, frozenCount: 39, founderAuthorized: false }).includes("1 more"), "fixture count is Founder-readable");
check(resolveFounderNextAction({ deploymentAccepted: true, technicalAccepted: true, frozenCount: 40, founderAuthorized: false }).includes("authorization"), "separate Founder authority remains required");

console.log("S2-T290 Founder Dice v4 window fixtures passed");
