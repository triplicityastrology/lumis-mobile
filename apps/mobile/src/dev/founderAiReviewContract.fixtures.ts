import {
  LATER_CHAT_FIXTURE_IDS,
  RATING_DIMENSIONS,
  RESERVED_DICE_FOUNDER_IDS,
  REVIEW_FIXTURES,
  canonicalJson,
  createFounderFixtureExportPayload,
  createEligibleFounderRuntimeRequest,
  createNotRunRecord,
  createVerdictPayload,
  freezeFounderDiceDraft,
  parseClosedGatewayEvidence,
  parseFounderRuntimeRequest,
  parseSyntheticReviewRecord,
  resolveCompanionGate,
  validateFounderDiceDraft,
} from "./founderAiReviewContract";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

check(RESERVED_DICE_FOUNDER_IDS.length === 40, "exactly 40 reserved Dice Founder IDs");
check(RESERVED_DICE_FOUNDER_IDS.filter((id) => id.includes("-EN-")).length === 20, "20 EN reserved IDs");
check(RESERVED_DICE_FOUNDER_IDS.filter((id) => id.includes("-ZH-")).length === 20, "20 zh-Hant reserved IDs");
check(new Set(RESERVED_DICE_FOUNDER_IDS).size === 40, "reserved IDs unique");
check(LATER_CHAT_FIXTURE_IDS.length === 4, "later Chat fixtures explicitly bounded");
REVIEW_FIXTURES.forEach(parseSyntheticReviewRecord);

for (const hostile of [
  { ...REVIEW_FIXTURES[0], account_id: "private" },
  { ...REVIEW_FIXTURES[0], raw_provider_response: "private" },
  { ...REVIEW_FIXTURES[0], fixture_id: "FREEFORM-1" },
  { ...REVIEW_FIXTURES[0], section: "companion_chat" },
  { ...REVIEW_FIXTURES[0], language: "zh-Hant" },
  { ...REVIEW_FIXTURES[0], rendered_output: "x".repeat(1201) },
  { ...REVIEW_FIXTURES[0], state: "not_yet_run", attempt_count: 1 },
]) {
  let rejected = false;
  try { parseSyntheticReviewRecord(hostile); } catch { rejected = true; }
  check(rejected, "hostile evidence must fail closed");
}

const ratings = Object.fromEntries(RATING_DIMENSIONS.map((key) => [key, 3])) as Record<(typeof RATING_DIMENSIONS)[number], 3>;
const payload = createVerdictPayload("a".repeat(40), [{ fixture_id: "DICE-FOUNDER-EN-01", ratings, verdict: "pending" }]);
check(payload.entries.length === 1, "closed verdict created");
check(canonicalJson(payload) === canonicalJson(JSON.parse(canonicalJson(payload))), "canonical JSON deterministic");
check(createNotRunRecord("DICE-FOUNDER-EN-20", "dice", "judgment").result_class === "not_run", "reserved not-run stays truthful");
check(REVIEW_FIXTURES.every((fixture) => fixture.state === "offline_preview" || fixture.state === "not_yet_run"), "embedded fixtures never claim live state");

const enDecision = validateFounderDiceDraft("Should I speak honestly about this choice?", "en");
check(enDecision.ok && enDecision.classification === "judgment", "EN judgment draft classifies");
const zhDecision = validateFounderDiceDraft("這段轉變有什麼值得我留意？", "zh-Hant");
check(zhDecision.ok && zhDecision.classification === "descriptive", "zh-Hant descriptive draft classifies");
check(freezeFounderDiceDraft("DICE-FOUNDER-EN-20", enDecision)?.effects.provider_calls === 0, "frozen Founder fixture is zero effect");
check(freezeFounderDiceDraft("DICE-FOUNDER-EN-21", enDecision) === null, "fixture outside reserve cannot freeze");
const frozenForty = RESERVED_DICE_FOUNDER_IDS.map((id) => {
  const decision = id.includes("-ZH-") ? zhDecision : enDecision;
  const frozen = freezeFounderDiceDraft(id, decision);
  check(frozen, `reserved fixture ${id} freezes`);
  return frozen;
});
check(createFounderFixtureExportPayload("a".repeat(40), frozenForty).fixtures.length === 40, "exact 20 EN and 20 zh-Hant package freezes");
let partialRejected = false;
try { createFounderFixtureExportPayload("a".repeat(40), frozenForty.slice(0, 39)); } catch { partialRejected = true; }
check(partialRejected, "39 fixtures cannot masquerade as a complete package");
check(Object.keys(parseFounderRuntimeRequest({ fixture_id: "DICE-FOUNDER-EN-01" })).join(",") === "fixture_id", "runtime parser accepts fixture ID only");
let runtimeTextRejected = false;
try { parseFounderRuntimeRequest({ fixture_id: "DICE-FOUNDER-EN-01", question: "Should I send this text?" }); } catch { runtimeTextRejected = true; }
check(runtimeTextRejected, "runtime rejects free-form question text");
let ineligibleRuntimeRejected = false;
try { createEligibleFounderRuntimeRequest({ fixture_id: "DICE-FOUNDER-EN-01" }, "b".repeat(64)); } catch { ineligibleRuntimeRejected = true; }
check(ineligibleRuntimeRejected, "reserved ID stays ineligible without accepted Technical evidence");
for (const [question, language] of [
  ["hi", "en"],
  ["My name is Ruby. What should I notice?", "en"],
  ["Should I do this? And also should I call?", "en"],
  ["Should I stop taking medication?", "en"],
  ["How does my natal chart affect this?", "en"],
  ["What should I notice?", "zh-Hant"],
] as const) check(!validateFounderDiceDraft(question, language).ok, `draft must reject ${question}`);

const evidence = {
  schema_version: "founder_ai_gateway_evidence_v2",
  fixture_id: "DICE-FOUNDER-EN-01",
  gateway: "dice",
  language: "en",
  state: "live_synthetic",
  expected_class: "judgment",
  result_class: "completed",
  safe_rendered_output: "A bounded synthetic interpretation.",
  latency_bucket: "under_3s",
  input_token_bucket: "0_to_400",
  output_token_bucket: "0_to_150",
  attempt_count: 1,
  retry_class: "none",
  effects: { provider_calls: 1, persistence_writes: 0, units_charged: 0 },
  technical_acceptance: {
    schema_version: "dice_technical_evidence_acceptance_v1",
    status: "accepted",
    registry_checksum: "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030",
    evidence_sha256: "b".repeat(64),
  },
};
for (const hostile of [
  evidence,
  { ...evidence, technical_acceptance: { ...evidence.technical_acceptance, evidence_sha256: "c".repeat(64) } },
  { ...evidence, technical_acceptance: { ...evidence.technical_acceptance, status: "pending" } },
  { ...evidence, raw_prompt: "private" },
  { ...evidence, effects: { ...evidence.effects, units_charged: 1 } },
  { ...evidence, fixture_id: "FREEFORM-01" },
]) {
  let rejected = false;
  try { parseClosedGatewayEvidence(hostile, "b".repeat(64)); } catch { rejected = true; }
  check(rejected, "fabricated or hostile gateway evidence must fail closed");
}
check(!resolveCompanionGate(false, true).enabled, "Companion cannot bypass Dice evidence");
check(!resolveCompanionGate(true, false).enabled, "Companion requires separate authority after Dice evidence");
check(resolveCompanionGate(true, true).enabled, "Companion needs both independent gates");

console.log("S2-T261 Founder AI review truth contract fixtures passed");
