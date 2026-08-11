import assert from "node:assert/strict";
import { classifyDiceQuestionRequest, DICE_QUESTION_MAX_LENGTH } from "./dice-question-boundary";

const accepted = [
  ["Should I reconnect with this person?", "person_relationship", "descriptive_reflection", "en"],
  ["When is the right time to raise this idea?", "timing", "judgment", "en"],
  ["What should I understand about this relationship?", "person_relationship", "descriptive_reflection", "en"],
  ["How should I approach this situation?", "descriptive", "descriptive_reflection", "en"],
  ["Where should I focus my search?", "place_location", "descriptive_reflection", "en"],
  ["What should I understand about my career direction?", "job_career", "descriptive_reflection", "en"],
  ["What should I reflect on before responding?", "open_reflection", "descriptive_reflection", "en"],
  ["我應該如何理解這段關係？", "person_relationship", "descriptive_reflection", "zh-Hant"]
] as const;

for (const [question, shape, route, language] of accepted) {
  const result = classifyDiceQuestionRequest({ question });
  assert.equal(result.accepted, true, question);
  if (result.accepted) {
    assert.equal(result.shape, shape);
    assert.equal(result.route, route);
    assert.equal(result.language, language);
    assert.deepEqual(result.effects, { provider_calls: 0, persistence_writes: 0, units_consumed: 0 });
  }
}

const stopped = [
  [{ question: "   " }, "DICE_QUESTION_EMPTY"],
  [{ question: "Will it work? Also should I wait?" }, "DICE_QUESTION_BUNDLED"],
  [{ question: "Should I choose A or B?" }, "DICE_CHOICE_REQUIRES_SEPARATE_THROWS"],
  [{ question: "Tell me" }, "DICE_QUESTION_UNCLEAR"],
  [{ question: "Should I change my medication?" }, "DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED"],
  [{ question: "Should I kill myself tonight?" }, "DICE_QUESTION_SAFETY_ROUTE_REQUIRED"],
  [{ question: "How does my birth chart change this throw?" }, "DICE_QUESTION_SCOPE_EXCLUDED"],
  [{ question: "Should I ask?", chart_context: {} }, "DICE_QUESTION_UNKNOWN_FIELD"],
  [{ question: "x".repeat(DICE_QUESTION_MAX_LENGTH + 1) }, "DICE_QUESTION_OVERSIZED"],
  [null, "DICE_QUESTION_REQUEST_INVALID"]
] as const;

for (const [input, code] of stopped) {
  const result = classifyDiceQuestionRequest(input);
  assert.equal(result.accepted, false);
  if (!result.accepted) assert.equal(result.code, code);
  assert.deepEqual(result.effects, { provider_calls: 0, persistence_writes: 0, units_consumed: 0 });
  assert.equal("normalized_question" in result, false);
}

const normalized = classifyDiceQuestionRequest({ question: "  What\r\nshould   I notice here?  " });
assert.equal(normalized.accepted && normalized.normalized_question, "What should I notice here?");

const zh08 = classifyDiceQuestionRequest({ question: "我個application 會唔會批？幾時會批？" });
assert.equal(zh08.accepted, false);
if (!zh08.accepted) assert.equal(zh08.code, "DICE_QUESTION_BUNDLED");

const zh09 = classifyDiceQuestionRequest({ question: "我個application幾時會批？" });
assert.equal(zh09.accepted, true);
if (zh09.accepted) {
  assert.equal(zh09.language, "zh-Hant");
  assert.equal(zh09.route, "judgment");
  assert.equal(zh09.shape, "timing");
}
console.log("Dice v0.3 pre-submit boundary fixtures passed");
