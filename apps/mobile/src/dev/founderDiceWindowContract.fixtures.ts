import {
  ACCEPTED_FOUNDER_WINDOW_AUTHORIZATION_SHA256,
  ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
  T262_PACKAGE_SHA256,
  authorizationRequestCanonicalJson,
  createFounderInvocation,
  createFounderWindowAuthorizationRequest,
  parseFounderExecutionEvidence,
  parsePostWindowProof,
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

const technicalSha = "a".repeat(64);
const authorizationSha = "b".repeat(64);
const technical = {
  schema_version: "s2_t269_dice_technical_evidence_import_v1",
  package_sha256: T262_PACKAGE_SHA256,
  gateway_interface: "dice_synthetic_gateway_port_v1",
  registry_checksum: "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030",
  phase: "technical",
  status: "accepted",
  logical_total: 80,
  language_totals: { en: 40, "zh-Hant": 40 },
  partial: false,
  provider_disabled_verified: true,
  records_sha256: "c".repeat(64),
  run_receipt_sha256: "d".repeat(64),
} as const;

check(ACCEPTED_TECHNICAL_EVIDENCE_SHA256 === null, "technical evidence is not self-accepted");
check(ACCEPTED_FOUNDER_WINDOW_AUTHORIZATION_SHA256 === null, "Founder window authority is not self-accepted");
rejected(() => parseTechnicalEvidenceImport(JSON.stringify(technical), technicalSha), "default build rejects self-authored technical evidence");
for (const hostile of [
  { ...technical, logical_total: 79 },
  { ...technical, language_totals: { en: 39, "zh-Hant": 40 } },
  { ...technical, partial: true },
  { ...technical, provider_disabled_verified: false },
  { ...technical, package_sha256: "e".repeat(64) },
  { ...technical, status: "loading" },
  { ...technical, error: "raw error" },
]) rejected(() => parseTechnicalEvidenceImport(JSON.stringify(hostile), technicalSha, technicalSha), "partial, stale, loading, error, or unknown evidence fails closed");
const acceptedTechnical = parseTechnicalEvidenceImport(JSON.stringify(technical), technicalSha, technicalSha);

const fixtures = RESERVED_DICE_FOUNDER_IDS.map((fixtureId) => {
  const language = fixtureId.includes("-ZH-") ? "zh-Hant" : "en";
  const question = language === "en" ? `What should I notice about decision ${fixtureId.slice(-2)}?` : `關於選擇${fixtureId.slice(-2)}，有什麼值得我留意？`;
  const decision = validateFounderDiceDraft(question, language);
  const frozen = freezeFounderDiceDraft(fixtureId, decision);
  check(frozen, `fixture must freeze: ${fixtureId}`);
  return frozen;
});
const request = createFounderWindowAuthorizationRequest({
  technicalEvidence: acceptedTechnical,
  technicalEvidenceSha256: technicalSha,
  founderFixturePackageSha256: "f".repeat(64),
  fixtures,
});
check(request.fixture_total === 40 && request.language_totals.en === 20 && request.language_totals["zh-Hant"] === 20, "authorization request is exactly 20/20");
check(!authorizationRequestCanonicalJson(request).includes(fixtures[0].question), "authorization request excludes question text");
check(Object.keys(createFounderInvocation("DICE-FOUNDER-EN-01")).join(",") === "fixture_id", "runtime request is fixture ID only");
rejected(() => createFounderInvocation("DICE-TECH-EN-JUDGMENT-01"), "technical fixture cannot enter Founder window");

const execution = {
  schema_version: "s2_t269_founder_execution_evidence_v1",
  package_sha256: T262_PACKAGE_SHA256,
  authorization_sha256: authorizationSha,
  fixture_id: "DICE-FOUNDER-EN-01",
  language: "en",
  state: "live_synthetic",
  result_class: "completed",
  safe_rendered_output: "A bounded synthetic interpretation.",
  attempt_count: 1,
  latency_bucket: "under_3s",
  input_token_bucket: "0_to_400",
  output_token_bucket: "0_to_150",
  provider_disabled_after_window: false,
  effects: { persistence_writes: 0, units_charged: 0 },
} as const;
rejected(() => parseFounderExecutionEvidence(JSON.stringify(execution), "e".repeat(64), execution.fixture_id), "live result is unavailable without accepted authority");
const acceptedExecution = parseFounderExecutionEvidence(JSON.stringify(execution), "e".repeat(64), execution.fixture_id, authorizationSha, "e".repeat(64));
check(acceptedExecution.safe_rendered_output.includes("bounded"), "safe interpretation projects after authority validation");
for (const hostile of [
  { ...execution, fixture_id: "DICE-FOUNDER-ZH-01" },
  { ...execution, safe_rendered_output: "" },
  { ...execution, state: "loading" },
  { ...execution, input_token_bucket: "801_to_1200" },
  { ...execution, effects: { persistence_writes: 1, units_charged: 0 } },
  { ...execution, raw_provider_response: "forbidden" },
]) rejected(() => parseFounderExecutionEvidence(JSON.stringify(hostile), "e".repeat(64), execution.fixture_id, authorizationSha, "e".repeat(64)), "unsafe or mismatched execution evidence fails closed");

const postWindow = {
  schema_version: "s2_t269_founder_post_window_disabled_v1",
  package_sha256: T262_PACKAGE_SHA256,
  authorization_sha256: authorizationSha,
  gateway_enabled: false,
  provider_access: false,
  founder_window_closed: true,
  provider_disabled_verified: true,
  evidence_sha256: "9".repeat(64),
} as const;
check(parsePostWindowProof(JSON.stringify(postWindow), authorizationSha).provider_disabled_verified, "closed post-window proof verifies disabled state");
rejected(() => parsePostWindowProof(JSON.stringify({ ...postWindow, provider_access: true }), authorizationSha), "residual provider access fails closed");

console.log("S2-T269 Founder Dice window fixtures passed");
