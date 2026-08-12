import assert from "node:assert/strict";

import { DICE_FOUNDER_FIXTURE_REGISTRY_SHA256 } from "../../services/diceFounderFixtureRegistry";
import {
  DICE_PRE_ROLL_NO_EFFECTS,
  validateDicePreRollQuestion,
  type DiceFounderFixtureBinding,
} from "./dicePreRollValidation";

const binding = (fixture_id: DiceFounderFixtureBinding["fixture_id"]): DiceFounderFixtureBinding => ({
  fixture_id,
  registry_sha256: DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
});

const rejected = [
  ["", undefined, "DICE_QUESTION_EMPTY"],
  ["hi", undefined, "DICE_QUESTION_UNCLEAR"],
  ["Will it work? Also should I wait?", undefined, "DICE_QUESTION_BUNDLED"],
  ["Should I choose this or that?", undefined, "DICE_CHOICE_REQUIRES_SEPARATE_THROWS"],
  ["Should I change my medication?", undefined, "DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED"],
  ["Should I kill myself tonight?", undefined, "DICE_QUESTION_SAFETY_ROUTE_REQUIRED"],
  ["How does my birth chart change this throw?", undefined, "DICE_QUESTION_SCOPE_EXCLUDED"],
  ["我個application 會唔會批？幾時會批？", binding("dice-founder-zh-07"), "DICE_QUESTION_BUNDLED"],
  ["我去到澳洲應該讀書定係做嘢？", binding("dice-founder-zh-04"), "DICE_FOUNDER_FIXTURE_MISMATCH"],
  ["How’s the condition in my current job like?", binding("dice-founder-en-02"), "DICE_FOUNDER_FIXTURE_MISMATCH"],
] as const;

for (const [question, founderFixture, code] of rejected) {
  const result = validateDicePreRollQuestion(question, founderFixture);
  assert.equal(result.accepted, false, question);
  if (!result.accepted) assert.equal(result.code, code, question);
  assert.deepEqual(result.effects, DICE_PRE_ROLL_NO_EFFECTS, question);
}

const en01 = validateDicePreRollQuestion("How’s the condition in my current job like?", binding("dice-founder-en-01"));
assert.equal(en01.accepted, true);
if (en01.accepted) assert.equal(en01.fixture_id, "dice-founder-en-01");

const zh09 = validateDicePreRollQuestion("我個application幾時會批？", binding("dice-founder-zh-08"));
assert.equal(zh09.accepted, true);
if (zh09.accepted) {
  assert.equal(zh09.language, "zh-Hant");
  assert.equal(zh09.route, "judgment");
  assert.equal(zh09.shape, "timing");
}

const staleRegistry = validateDicePreRollQuestion("我個application幾時會批？", {
  fixture_id: "dice-founder-zh-08",
  registry_sha256: "0".repeat(64) as typeof DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
});
assert.equal(staleRegistry.accepted, false);
assert.deepEqual(staleRegistry.effects, DICE_PRE_ROLL_NO_EFFECTS);

console.log("S2-T322 Dice pre-roll validation fixtures passed");
