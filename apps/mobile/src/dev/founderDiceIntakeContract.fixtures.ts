import {
  createFounderIntakePackage,
  createFounderRatingSheet,
  createFounderRuntimeRequest,
  createFrozenIntakeQuestion,
  validateFounderIntakeQuestion,
} from "./founderDiceIntakeContract";
import { RESERVED_DICE_FOUNDER_IDS } from "./founderAiReviewContract";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function rejects(fn: () => unknown, message: string): void {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  check(rejected, message);
}

for (const [question, language, code] of [
  ["", "en", "QUESTION_EMPTY"],
  ["hi", "en", "QUESTION_TOO_SHORT"],
  ["Should I call? And also should I wait?", "en", "QUESTION_BUNDLED"],
  ["Should I stop taking medication?", "en", "QUESTION_UNSAFE"],
  ["What does my natal chart say?", "en", "QUESTION_EXCLUDED"],
  ["Should I email someone@example.invalid?", "en", "QUESTION_PRIVATE_DATA"],
  ["我的身份證是 A123456，這件事應該怎樣處理？", "zh-Hant", "QUESTION_PRIVATE_DATA"],
] as const) {
  const result = validateFounderIntakeQuestion(question, language);
  check(!result.ok && result.code === code, `${code} must fail locally`);
}

const fixtures = RESERVED_DICE_FOUNDER_IDS.map((id, index) => {
  const language = id.includes("-ZH-") ? "zh-Hant" as const : "en" as const;
  const question = language === "en"
    ? `Should I notice a different practical signal in decision ${index + 1}?`
    : `在第${index + 1}個選擇中，我應該留意哪個實際訊號？`;
  return createFrozenIntakeQuestion(id, question, language, (index + 1).toString(16).padStart(64, "0"));
});

const intake = createFounderIntakePackage("a".repeat(40), fixtures);
check(intake.fixture_total === 40, "exactly 40 fixtures freeze");
check(intake.language_totals.en === 20 && intake.language_totals["zh-Hant"] === 20, "20/20 language split");
check(intake.runtime_request_fields.join(",") === "fixture_id", "runtime accepts fixture ID only");
check(intake.effects.provider_calls === 0 && intake.effects.persistence_writes === 0 && intake.effects.units_charged === 0, "intake is zero effect");
check(createFounderRatingSheet("a".repeat(40), "b".repeat(64), fixtures).rows.length === 40, "rating sheet covers every fixture");

rejects(() => createFounderIntakePackage("a".repeat(40), fixtures.slice(0, 39)), "39 fixtures rejected");
rejects(() => createFounderIntakePackage("a".repeat(40), [...fixtures.slice(0, 39), fixtures[0]]), "duplicate fixture rejected");
rejects(() => createFounderRuntimeRequest("DICE-FOUNDER-EN-01", false, false), "Technical evidence required");
rejects(() => createFounderRuntimeRequest("DICE-FOUNDER-EN-01", true, false), "Founder receipt required");
check(Object.keys(createFounderRuntimeRequest("DICE-FOUNDER-EN-01", true, true)).sort().join(",") === "fixture_id,schema_version", "eligible request stays closed");

console.log("S2-T285 Founder Dice intake fixtures passed");
