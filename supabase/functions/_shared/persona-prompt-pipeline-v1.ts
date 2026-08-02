import {
  calculatePersonaProfile,
  type CustomerMoonInput,
  type PersonaRoleInput,
} from "../../../packages/shared/src/config/persona-calculator";

import {
  assemblePersonaBehaviorPromptFromCalculation,
  type PersonaBehaviorFailureCode,
  type PersonaBehaviorPromptPayload,
  type PersonaEmotionalState,
  type PersonaLanguage,
  type PersonaRoleCode,
  type PersonaSafetyMode,
} from "./persona-behavior-v1";

export const PERSONA_PROMPT_PIPELINE_VERSION = "v1" as const;

export type PersonaPromptPipelineInput = {
  pipelineVersion: typeof PERSONA_PROMPT_PIPELINE_VERSION;
  roleCode: PersonaRoleInput;
  customerSigns: {
    sunSign: number;
    mercurySign?: number;
    moon: CustomerMoonInput;
  };
  safetyMode: PersonaSafetyMode;
  emotionalState: PersonaEmotionalState;
  language: PersonaLanguage;
};

export type PersonaPromptSafePayload = Omit<PersonaBehaviorPromptPayload, "sourceRulesApplied"> & {
  pipelineVersion: typeof PERSONA_PROMPT_PIPELINE_VERSION;
  roleCode: PersonaRoleCode;
};

export type PersonaPromptPipelineResult =
  | { ok: true; value: PersonaPromptSafePayload }
  | {
      ok: false;
      error: {
        code:
          | "PERSONA_PROMPT_PIPELINE_INACTIVE"
          | "PERSONA_PROMPT_PIPELINE_INPUT_INVALID"
          | PersonaBehaviorFailureCode;
      };
    };

type TrustedPipelineRuntime = {
  authority: "trusted_server_config";
  enabled: boolean;
};

const INACTIVE_RUNTIME: TrustedPipelineRuntime = {
  authority: "trusted_server_config",
  enabled: false,
};

export function runPersonaPromptPipeline(
  input: unknown,
  runtime: TrustedPipelineRuntime = INACTIVE_RUNTIME
): PersonaPromptPipelineResult {
  if (!isTrustedRuntime(runtime) || !runtime.enabled) return failure("PERSONA_PROMPT_PIPELINE_INACTIVE");
  if (!isClosedInput(input)) return failure("PERSONA_PROMPT_PIPELINE_INPUT_INVALID");

  const calculation = calculatePersonaProfile({
    roleCode: input.roleCode,
    sunSign: input.customerSigns.sunSign,
    mercurySign: input.customerSigns.mercurySign,
    moon: input.customerSigns.moon,
  });
  if (!calculation.ok) {
    return failure(calculation.code === "customer_chart_unavailable"
      ? "customer_chart_unavailable"
      : "PERSONA_PROMPT_PIPELINE_INPUT_INVALID");
  }

  const assembled = assemblePersonaBehaviorPromptFromCalculation(calculation, {
    assemblerVersion: "v1",
    mappingVersion: "v1",
    safetyMode: input.safetyMode,
    emotionalState: input.emotionalState,
    language: input.language,
  });
  if (!assembled.ok) return assembled;

  const { sourceRulesApplied: _runtimeProvenance, ...promptSafe } = assembled.value;
  return {
    ok: true,
    value: {
      pipelineVersion: "v1",
      roleCode: calculation.roleCode,
      ...promptSafe,
    },
  };
}

function isTrustedRuntime(value: unknown): value is TrustedPipelineRuntime {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 2 &&
    (value as Record<string, unknown>).authority === "trusted_server_config" &&
    typeof (value as Record<string, unknown>).enabled === "boolean");
}

function isClosedInput(value: unknown): value is PersonaPromptPipelineInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["pipelineVersion", "roleCode", "customerSigns", "safetyMode", "emotionalState", "language"];
  if (Object.keys(record).length !== keys.length || !keys.every((key) => key in record)) return false;
  if (record.pipelineVersion !== "v1" || typeof record.roleCode !== "string") return false;
  if (record.safetyMode !== "standard" && record.safetyMode !== "safety_override") return false;
  if (record.emotionalState !== "steady" && record.emotionalState !== "heightened_distress" && record.emotionalState !== "acute_distress") return false;
  if (record.language !== "en" && record.language !== "zh-Hant") return false;
  const signs = record.customerSigns;
  if (!signs || typeof signs !== "object" || Array.isArray(signs)) return false;
  const signRecord = signs as Record<string, unknown>;
  const signKeys = Object.keys(signRecord);
  return (signKeys.length === 2 || signKeys.length === 3) &&
    signKeys.every((key) => key === "sunSign" || key === "mercurySign" || key === "moon") &&
    "sunSign" in signRecord && "moon" in signRecord;
}

function failure(code: PersonaPromptPipelineResult extends infer _ ?
  "PERSONA_PROMPT_PIPELINE_INACTIVE" | "PERSONA_PROMPT_PIPELINE_INPUT_INVALID" | PersonaBehaviorFailureCode : never
): PersonaPromptPipelineResult {
  return { ok: false, error: { code } };
}
