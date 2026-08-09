import assert from "node:assert/strict";
import {
  DICE_INTERPRETATION_ENABLED,
  DICE_INTERPRETATION_REQUEST_VERSION,
  DICE_INTERPRETATION_RESPONSE_VERSION,
  assembleDicePrompt,
  buildDiceRoutingEnvelope,
  buildDiceRoutingEnvelopeForTest,
  projectDiceInterpretationResponse,
  validateDiceInterpretationRequest,
} from "./dice-interpretation-v1";

const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"];
const signs = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const houses = Array.from({ length: 12 }, (_, index) => `house_${index + 1}`);
const request = (question = "Should I take the next step?") => ({ schemaVersion: DICE_INTERPRETATION_REQUEST_VERSION, question, outcome: { planet: "venus", sign: "sagittarius", house: "house_10" } });

assert.equal(DICE_INTERPRETATION_ENABLED, false);
assert.deepEqual(buildDiceRoutingEnvelope(request(), { questionShape: "judgment", safetyDisposition: "ordinary" }), { ok: false, code: "DICE_INTERPRETATION_DISABLED" });

for (const planet of planets) assert.equal(validateDiceInterpretationRequest({ ...request(), outcome: { ...request().outcome, planet } }).ok, true);
for (const sign of signs) assert.equal(validateDiceInterpretationRequest({ ...request(), outcome: { ...request().outcome, sign } }).ok, true);
for (const house of houses) assert.equal(validateDiceInterpretationRequest({ ...request(), outcome: { ...request().outcome, house } }).ok, true);

for (const prohibited of ["chartContext", "birthData", "persona", "history", "provider", "routingAuthority", "credentials"]) {
  const result = validateDiceInterpretationRequest({ ...request(), [prohibited]: "private" });
  assert.deepEqual(result, { ok: false, code: "DICE_INTERPRETATION_INVALID_REQUEST" });
}

const en = buildDiceRoutingEnvelopeForTest(request(), { questionShape: "judgment", safetyDisposition: "ordinary" });
assert.equal(en.ok && en.value.language, "en");
assert.equal(en.ok && en.value.requiredPreludeTemplateId, null);
const zh = buildDiceRoutingEnvelopeForTest(request("我應該接受這個機會嗎？"), { questionShape: "judgment", safetyDisposition: "ordinary" });
assert.equal(zh.ok && zh.value.language, "zh-Hant");
assert.deepEqual(buildDiceRoutingEnvelopeForTest(request(), { questionShape: null, safetyDisposition: "ordinary" }), { ok: false, code: "DICE_INTERPRETATION_AUTHORITY_UNAVAILABLE" });
assert.deepEqual(buildDiceRoutingEnvelopeForTest(request("我需要緊急幫助"), { questionShape: "open_reflection", safetyDisposition: "crisis_imminent", appLanguage: "zh-Hant" }), { ok: false, code: "DICE_INTERPRETATION_FIXED_TEMPLATE_REQUIRED", templateId: "CRISIS_IMMINENT_ZH_HANT" });
const reflective = buildDiceRoutingEnvelopeForTest(request("我想反思健康方面的焦慮"), { questionShape: "open_reflection", safetyDisposition: "professional_reflective", appLanguage: "zh-Hant" });
assert.equal(reflective.ok && reflective.value.requiredPreludeTemplateId, "PROFESSIONAL_REFLECTIVE_DISCLAIMER_ZH_HANT");
assert.deepEqual(buildDiceRoutingEnvelopeForTest(request(), { questionShape: "judgment", safetyDisposition: "unknown" as never }), { ok: false, code: "DICE_INTERPRETATION_AUTHORITY_UNAVAILABLE" });

if (!en.ok) throw new Error("fixture envelope unavailable");
const prompt = assembleDicePrompt(en.value);
assert.equal(prompt.input.contextPolicy, "dice_only_no_chart_persona_or_knowledge_bank");
assert.doesNotMatch(JSON.stringify(prompt), /birthData|chartContext|accountId|providerCredential/);

const validEn = projectDiceInterpretationResponse({ version: DICE_INTERPRETATION_RESPONSE_VERSION, language: "en", reading: "This combination favors a measured next step.", watchOut: "Avoid treating momentum as certainty.", practicalDirection: "Name one reversible action." }, "en");
assert.equal(validEn.ok, true);
const validZh = projectDiceInterpretationResponse({ version: DICE_INTERPRETATION_RESPONSE_VERSION, language: "zh-Hant", reading: "這組合適合先踏出審慎的一步。", watchOut: "不要把動力當成確定答案。", practicalDirection: "先列出一個可以回頭的小行動。" }, "zh-Hant");
assert.equal(validZh.ok, true);
assert.equal(projectDiceInterpretationResponse({ version: DICE_INTERPRETATION_RESPONSE_VERSION, language: "en", reading: "x".repeat(701), watchOut: "safe", practicalDirection: "safe" }, "en").ok, false);
assert.equal(projectDiceInterpretationResponse({ version: DICE_INTERPRETATION_RESPONSE_VERSION, language: "en", reading: "可以", watchOut: "safe", practicalDirection: "safe" }, "en").ok, false);
assert.equal(projectDiceInterpretationResponse({ version: DICE_INTERPRETATION_RESPONSE_VERSION, language: "en", reading: "safe", watchOut: "safe", practicalDirection: "safe", raw: "extra" }, "en").ok, false);

console.log("S2-T176 inactive Dice interpretation fixtures passed.");
