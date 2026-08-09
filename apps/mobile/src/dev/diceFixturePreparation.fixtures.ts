import { classifyLocalDraft, freezeLocalFounderFixture } from "./diceFixturePreparation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const en = classifyLocalDraft("What can I notice about this friendship?", "en");
assert(en.ok && en.route === "descriptive_reflection", "valid EN draft should classify");
const frozen = freezeLocalFounderFixture("DICE-FOUNDER-EN-01", "en", en);
assert(frozen?.review_status === "locally_frozen_pending_review", "valid reserved slot should freeze locally");
assert(frozen.effects.provider_calls === 0 && frozen.effects.persistence_writes === 0 && frozen.effects.units_consumed === 0, "frozen fixture must be zero-effect");

const zh = classifyLocalDraft("我可以如何理解這段友誼？", "zh-Hant");
assert(zh.ok && freezeLocalFounderFixture("DICE-FOUNDER-ZH-20", "zh-Hant", zh)?.language === "zh-Hant", "valid final zh-Hant slot should freeze");
assert(!classifyLocalDraft("hi", "en").ok, "unclear draft should fail");
assert(!classifyLocalDraft("My name is Ruby. What should I notice?", "en").ok, "name-bearing draft should fail");
assert(!classifyLocalDraft("What should I notice?", "zh-Hant").ok, "language mismatch should fail");
assert(freezeLocalFounderFixture("DICE-FOUNDER-EN-21", "en", en) === null, "slot beyond reserve must fail");

console.log("S2_T248_MOBILE_FIXTURE_PREPARATION_OK");
