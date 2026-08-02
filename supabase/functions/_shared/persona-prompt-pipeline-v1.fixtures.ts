import { runPersonaPromptPipeline } from "./persona-prompt-pipeline-v1";

const enabled = { authority: "trusted_server_config", enabled: true } as const;
const roles = [
  ["empathetic_peer", "Acceptance"],
  ["harmonious_catalyst", "Spark"],
  ["saturnian_anchor", "Awareness"],
] as const;
const languages = ["en", "zh-Hant"] as const;

for (const [roleCode, publicName] of roles) {
  for (const language of languages) {
    for (const moon of [
      { status: "available", proof: "confirmed_birth_time", sign: 8 } as const,
      { status: "unconfirmed" } as const,
    ]) {
      const result = runPersonaPromptPipeline({
        pipelineVersion: "v1",
        roleCode,
        customerSigns: { sunSign: 2, mercurySign: 12, moon },
        safetyMode: "standard",
        emotionalState: "steady",
        language,
      }, enabled);
      truthy(result.ok, `${roleCode}/${language}/${moon.status} assembles`);
      if (!result.ok) continue;
      equal(result.value.roleCode, roleCode, "stable role code retained");
      equal(result.value.roleContract.publicName, publicName, "public role contract retained");
      equal(result.value.language, language, "deterministic language retained");
      truthy(result.value.behaviorModifiers.length > 0, "resolved ordinary mapping included");
      equal(result.value.responseInstruction, "Respond naturally; do not mention internal calculations or mapping IDs.", "safe instruction retained");
      rejectsKeys(result.value, ["provenance", "customerSigns", "customerMoonProof", "sourceRulesApplied", "rawChart", "birthDate", "birthTime"]);
    }
  }
}

expectFailure(validInput(), undefined, "PERSONA_PROMPT_PIPELINE_INACTIVE");
expectFailure({ ...validInput(), customerSigns: { sunSign: 2, moon: { status: "unconfirmed" } } }, enabled, "customer_chart_unavailable");
expectFailure({ ...validInput(), customerSigns: { sunSign: 2, mercurySign: 12, moon: { status: "available", proof: "noon_default", sign: 8 } } }, enabled, "customer_chart_unavailable");
expectFailure({ ...validInput(), rawChart: { private: true } }, enabled, "PERSONA_PROMPT_PIPELINE_INPUT_INVALID");

console.log("inactive Persona prompt pipeline fixtures passed");

function validInput(): Record<string, unknown> {
  return {
    pipelineVersion: "v1",
    roleCode: "Acceptance",
    customerSigns: { sunSign: 2, mercurySign: 12, moon: { status: "unconfirmed" } },
    safetyMode: "standard",
    emotionalState: "steady",
    language: "en",
  };
}

function expectFailure(input: unknown, runtime: typeof enabled | undefined, code: string): void {
  const result = runtime ? runPersonaPromptPipeline(input, runtime) : runPersonaPromptPipeline(input);
  equal(result.ok, false, `${code} stops`);
  if (!result.ok) equal(result.error.code, code, `${code} is non-echoing`);
}

function rejectsKeys(value: unknown, forbidden: string[]): void {
  const serialized = JSON.stringify(value);
  for (const key of forbidden) truthy(!serialized.includes(key), `${key} excluded`);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: assertion failed`);
}
