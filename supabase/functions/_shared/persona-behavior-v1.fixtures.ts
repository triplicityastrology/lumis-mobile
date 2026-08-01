import { PERSONA_BEHAVIOR_MAPPING_V1 } from "./persona-behavior-mapping-v1";
import { assemblePersonaBehaviorPrompt, type PersonaBehaviorFailureCode } from "./persona-behavior-v1";

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

const fallback = assemblePersonaBehaviorPrompt({
  ...validInput(),
  calculatedProfile: [{ factor: "ASC", signNumber: 4, sign: "Cancer" }, { factor: "Mercury", signNumber: 5, sign: "Leo" }],
  fallbacksApplied: ["neutral_emotional_attunement"],
});
truthy(fallback.ok, "approved missing-Moon fallback assembles");

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
    fallbacksApplied: [],
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
