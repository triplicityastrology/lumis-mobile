import {
  LATER_CHAT_FIXTURE_IDS,
  RATING_DIMENSIONS,
  RESERVED_DICE_FOUNDER_IDS,
  REVIEW_FIXTURES,
  canonicalJson,
  createNotRunRecord,
  createVerdictPayload,
  freezeFounderDiceDraft,
  parseClosedGatewayEvidence,
  parseSyntheticReviewRecord,
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

const enDecision = validateFounderDiceDraft("Should I speak honestly about this choice?", "en");
check(enDecision.ok && enDecision.classification === "judgment", "EN judgment draft classifies");
const zhDecision = validateFounderDiceDraft("這段轉變有什麼值得我留意？", "zh-Hant");
check(zhDecision.ok && zhDecision.classification === "descriptive", "zh-Hant descriptive draft classifies");
check(freezeFounderDiceDraft("DICE-FOUNDER-EN-20", enDecision)?.effects.provider_calls === 0, "frozen Founder fixture is zero effect");
check(freezeFounderDiceDraft("DICE-FOUNDER-EN-21", enDecision) === null, "fixture outside reserve cannot freeze");
for (const [question, language] of [
  ["hi", "en"],
  ["My name is Ruby. What should I notice?", "en"],
  ["Should I do this? And also should I call?", "en"],
  ["Should I stop taking medication?", "en"],
  ["How does my natal chart affect this?", "en"],
  ["What should I notice?", "zh-Hant"],
] as const) check(!validateFounderDiceDraft(question, language).ok, `draft must reject ${question}`);

const evidence = {
  schema_version: "founder_ai_gateway_evidence_v1",
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
};
check(parseClosedGatewayEvidence(evidence).state === "live_synthetic", "closed Dice evidence maps into review record");
for (const hostile of [
  { ...evidence, raw_prompt: "private" },
  { ...evidence, effects: { ...evidence.effects, units_charged: 1 } },
  { ...evidence, fixture_id: "FREEFORM-01" },
]) {
  let rejected = false;
  try { parseClosedGatewayEvidence(hostile); } catch { rejected = true; }
  check(rejected, "hostile gateway evidence must fail closed");
}

console.log("S2-T256 Founder AI end-to-end review contract fixtures passed");
