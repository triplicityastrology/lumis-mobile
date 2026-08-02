import { PERSONA_BEHAVIOR_MAPPING_V1 } from "./persona-behavior-mapping-v1";
import { assemblePersonaBehaviorPrompt, assemblePersonaBehaviorPromptFromCalculation, type PersonaBehaviorFailureCode } from "./persona-behavior-v1";

equal(PERSONA_BEHAVIOR_MAPPING_V1.length, 60, "all approved mapping rows");
equal(new Set(PERSONA_BEHAVIOR_MAPPING_V1.map((row) => row.mappingId)).size, 60, "mapping IDs unique");
equal(new Set(PERSONA_BEHAVIOR_MAPPING_V1.map((row) => `${row.factor}:${row.signNumber}`)).size, 60, "factor/sign keys unique");

const acceptance = assemblePersonaBehaviorPrompt(validInput());
truthy(acceptance.ok, "valid profile assembles");
if (acceptance.ok) {
  equal(acceptance.value.roleContract.publicName, "Acceptance", "public name preserved");
  equal(acceptance.value.behaviorModifiers.length, 3, "one mapping per resolved factor");
  equal(acceptance.value.priorityOrder.join("|"), "safety|emotional_state|immutable_role|calculated_profile|behavior_mapping|conflict_resolution|language", "priority order");
  rejectsInternalDetails(acceptance.value);
}

const distressed = assemblePersonaBehaviorPrompt({ ...validInput(), emotionalState: "heightened_distress" });
truthy(distressed.ok, "distress adjustment assembles");
if (distressed.ok) equal(distressed.value.situationParameters.humour, "paused", "distress pauses humour");

const safety = assemblePersonaBehaviorPrompt({ ...validInput(), safetyMode: "safety_override" });
truthy(safety.ok, "safety override assembles");
if (safety.ok) {
  equal(safety.value.behaviorModifiers.length, 0, "safety suppresses persona modifiers");
  equal(safety.value.safetyOverride, true, "safety marked");
}

expectFailure({ ...validInput(), language: "fr" }, "PERSONA_BEHAVIOR_LANGUAGE_UNKNOWN");
expectFailure({ ...validInput(), ruleVersion: "v2" }, "PERSONA_BEHAVIOR_VERSION_UNKNOWN");
expectFailure({ ...validInput(), roleCode: "unknown" }, "PERSONA_BEHAVIOR_ROLE_UNKNOWN");
expectFailure({ ...validInput(), extra: "not allowed" }, "PERSONA_BEHAVIOR_INPUT_INVALID");
expectFailure({ ...validInput(), calculatedProfile: [{ factor: "ASC", signNumber: 4, sign: "Cancer" }] }, "PERSONA_BEHAVIOR_PROFILE_INVALID");
expectFailure({ ...validInput(), calculatedProfile: [{ factor: "ASC", signNumber: 4, sign: "Cancer" }, { factor: "Moon", signNumber: 8, sign: "Scorpio" }, { factor: "Mercury", signNumber: 5, sign: "Not Leo" }] }, "PERSONA_BEHAVIOR_MAPPING_MISSING");

const derivedMoon = assemblePersonaBehaviorPrompt({
  ...validInput(),
  sourceRulesApplied: ["acceptance_moon_from_customer_sun"],
});
truthy(derivedMoon.ok, "deterministic Sun-derived Moon assembles");

expectFailure({ ...validInput(), calculatedProfile: [{ factor: "ASC", signNumber: 4, sign: "Cancer" }, { factor: "Mercury", signNumber: 5, sign: "Leo" }] }, "PERSONA_BEHAVIOR_PROFILE_INVALID");

const stopped = assemblePersonaBehaviorPromptFromCalculation(
  { ok: false, code: "customer_chart_unavailable", action: "stop_persona_generation_and_retry" },
  promptContext()
);
equal(JSON.stringify(stopped), JSON.stringify({ ok: false, error: { code: "customer_chart_unavailable" } }), "unavailable chart stops prompt assembly");

const fromCalculation = assemblePersonaBehaviorPromptFromCalculation({
  ok: true,
  ruleVersion: "v1",
  roleCode: "harmonious_catalyst",
  calculatedProfile: [
    { factor: "ASC", signNumber: 3, sign: "Gemini", source: "fixed_role", offset: 0 },
    { factor: "Sun", signNumber: 4, sign: "Cancer", source: "customer_sun", offset: 2 },
    { factor: "Moon", signNumber: 6, sign: "Virgo", source: "customer_sun", offset: 4, sourceRuleCode: "spark_moon_from_customer_sun_trine" },
    { factor: "Mercury", signNumber: 10, sign: "Capricorn", source: "customer_mercury", offset: 2 },
  ],
  sourceRulesApplied: ["spark_moon_from_customer_sun_trine"],
  provenance: { customerMoonStatus: "unconfirmed", customerMoonProof: "unconfirmed" },
}, promptContext());
truthy(fromCalculation.ok, "complete calculated Spark profile assembles");

const awarenessVirgo = assemblePersonaBehaviorPromptFromCalculation({
  ok: true,
  ruleVersion: "v1",
  roleCode: "saturnian_anchor",
  calculatedProfile: [
    { factor: "ASC", signNumber: 10, sign: "Capricorn", source: "fixed_role", offset: 0 },
    { factor: "Sun", signNumber: 3, sign: "Gemini", source: "customer_sun", offset: 2 },
    { factor: "Saturn", signNumber: 10, sign: "Capricorn", source: "customer_moon", offset: 2 },
    { factor: "Mercury", signNumber: 6, sign: "Virgo", source: "customer_mercury", offset: 6 },
  ],
  sourceRulesApplied: [],
  provenance: { customerMoonStatus: "available", customerMoonProof: "confirmed_birth_time" },
}, promptContext());
truthy(awarenessVirgo.ok, "Pisces Mercury plus six assembles as Virgo");
if (awarenessVirgo.ok) {
  truthy(
    awarenessVirgo.value.behaviorModifiers.some((modifier) => modifier.includes("Use precise, orderly language. Separate facts, assumptions, and next steps")),
    "approved Mercury-in-Virgo description used"
  );
}

console.log("persona behavior registry fixtures passed");

function validInput(): Record<string, unknown> {
  return {
    assemblerVersion: "v1",
    ruleVersion: "v1",
    mappingVersion: "v1",
    roleCode: "empathetic_peer",
    safetyMode: "standard",
    emotionalState: "steady",
    calculatedProfile: [
      { factor: "ASC", signNumber: 4, sign: "Cancer" },
      { factor: "Moon", signNumber: 8, sign: "Scorpio" },
      { factor: "Mercury", signNumber: 5, sign: "Leo" },
    ],
    sourceRulesApplied: [],
    language: "en",
  };
}

function promptContext(): Record<string, unknown> {
  return {
    assemblerVersion: "v1",
    mappingVersion: "v1",
    safetyMode: "standard",
    emotionalState: "steady",
    language: "en",
  };
}

function expectFailure(input: Record<string, unknown>, code: PersonaBehaviorFailureCode): void {
  const result = assemblePersonaBehaviorPrompt(input);
  equal(result.ok, false, `${code} rejected`);
  if (!result.ok) equal(JSON.stringify(result.error), JSON.stringify({ code }), `${code} non-echoing`);
}

function rejectsInternalDetails(value: unknown): void {
  const forbiddenKeys = new Set(["mappingId", "mapping_id", "offset", "sourceSign", "source_sign"]);
  visit(value);

  function visit(entry: unknown): void {
    if (Array.isArray(entry)) return entry.forEach(visit);
    if (!entry || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry)) {
      if (forbiddenKeys.has(key)) throw new Error("internal calculation details leaked");
      visit(child);
    }
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: assertion failed`);
}
