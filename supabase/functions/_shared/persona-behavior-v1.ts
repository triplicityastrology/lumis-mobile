import {
  PERSONA_BEHAVIOR_MAPPING_V1,
  PERSONA_BEHAVIOR_MAPPING_VERSION,
  type PersonaMappingFactor,
} from "./persona-behavior-mapping-v1";

export const PERSONA_BEHAVIOR_ASSEMBLER_VERSION = "v1" as const;

export type PersonaRoleCode =
  | "empathetic_peer"
  | "harmonious_catalyst"
  | "saturnian_anchor";
export type PersonaLanguage = "en" | "zh-Hant";
export type PersonaEmotionalState = "steady" | "heightened_distress" | "acute_distress";
export type PersonaSafetyMode = "standard" | "safety_override";
export type PersonaBehaviorFailureCode =
  | "customer_chart_unavailable"
  | "PERSONA_BEHAVIOR_INPUT_INVALID"
  | "PERSONA_BEHAVIOR_VERSION_UNKNOWN"
  | "PERSONA_BEHAVIOR_ROLE_UNKNOWN"
  | "PERSONA_BEHAVIOR_LANGUAGE_UNKNOWN"
  | "PERSONA_BEHAVIOR_PROFILE_INVALID"
  | "PERSONA_BEHAVIOR_MAPPING_MISSING";

type ResolvedFactor = {
  factor: PersonaMappingFactor;
  signNumber: number;
  sign: string;
};

type PersonaSourceRuleCode =
  | "acceptance_moon_from_customer_sun"
  | "spark_moon_from_customer_sun_trine"
  | "awareness_saturn_from_customer_sun_sextile";

export type PersonaBehaviorAssemblyInput = {
  assemblerVersion: typeof PERSONA_BEHAVIOR_ASSEMBLER_VERSION;
  ruleVersion: "v1";
  mappingVersion: typeof PERSONA_BEHAVIOR_MAPPING_VERSION;
  roleCode: PersonaRoleCode;
  safetyMode: PersonaSafetyMode;
  emotionalState: PersonaEmotionalState;
  calculatedProfile: ResolvedFactor[];
  sourceRulesApplied: PersonaSourceRuleCode[];
  language: PersonaLanguage;
};

export type PersonaBehaviorPromptPayload = {
  assemblerVersion: "v1";
  ruleVersions: { persona: "v1"; mapping: "v1" };
  priorityOrder: readonly [
    "safety",
    "emotional_state",
    "immutable_role",
    "calculated_profile",
    "behavior_mapping",
    "conflict_resolution",
    "language"
  ];
  safetyOverride: boolean;
  roleContract: {
    publicName: "Acceptance" | "Spark" | "Awareness";
    corePurpose: string;
    requiredBehaviors: string;
    baseTone: string;
    hardGuardrail: string;
  };
  situationParameters: {
    pace: "normal" | "slower" | "slow";
    humour: "role_default" | "paused";
    challenge: "role_default" | "gentle" | "paused";
    advice: "by_consent" | "minimal";
    responseLength: "normal" | "shorter";
  };
  calculatedProfile: ResolvedFactor[];
  behaviorModifiers: string[];
  sourceRulesApplied: PersonaSourceRuleCode[];
  language: PersonaLanguage;
  responseInstruction: string;
};

export type PersonaBehaviorAssemblyResult =
  | { ok: true; value: PersonaBehaviorPromptPayload }
  | { ok: false; error: { code: PersonaBehaviorFailureCode } };

const PRIORITY_ORDER = [
  "safety",
  "emotional_state",
  "immutable_role",
  "calculated_profile",
  "behavior_mapping",
  "conflict_resolution",
  "language",
] as const;

const ROLE_CONTRACTS = {
  empathetic_peer: {
    publicName: "Acceptance",
    corePurpose: "Offer emotional presence, acceptance, and a safe place to talk.",
    requiredBehaviors: "Reflect feelings first; ask whether the user wants listening or help organising; keep advice light unless invited.",
    baseTone: "Warm, unhurried, non-judgmental, grounded.",
    hardGuardrail: "Accept feelings without automatically confirming conclusions, accusations, catastrophic predictions, or harmful ideas.",
    factors: ["ASC", "Moon", "Mercury"],
  },
  harmonious_catalyst: {
    publicName: "Spark",
    corePurpose: "Bring energy, a fresh angle, and a manageable next step without creating pressure.",
    requiredBehaviors: "Use one or two new perspectives; encourage rather than push; invite the user to choose or reject suggestions.",
    baseTone: "Lively, friendly, flexible, lightly playful when appropriate.",
    hardGuardrail: "Pause humour when grief, high anxiety, shock, or acute distress is present. Do not turn every response into action coaching.",
    factors: ["ASC", "Sun", "Moon", "Mercury"],
  },
  saturnian_anchor: {
    publicName: "Awareness",
    corePurpose: "Offer calm structure, identify a meaningful blind spot, and guide the user toward a realistic next step.",
    requiredBehaviors: "Ask permission before direct challenge when appropriate; identify no more than one main blind spot; explain reasoning; propose one practical step.",
    baseTone: "Steady, thoughtful, respectful, clear, quietly authoritative.",
    hardGuardrail: "Do not oppose for the sake of opposition. Saturn means structure, boundaries, and responsibility—not blame, shame, or obedience.",
    factors: ["ASC", "Sun", "Saturn", "Mercury"],
  },
} as const;

export function assemblePersonaBehaviorPrompt(input: unknown): PersonaBehaviorAssemblyResult {
  if (!isClosedInput(input)) return failure("PERSONA_BEHAVIOR_INPUT_INVALID");
  if (input.assemblerVersion !== "v1" || input.ruleVersion !== "v1" || input.mappingVersion !== "v1") {
    return failure("PERSONA_BEHAVIOR_VERSION_UNKNOWN");
  }
  if (!Object.prototype.hasOwnProperty.call(ROLE_CONTRACTS, input.roleCode)) {
    return failure("PERSONA_BEHAVIOR_ROLE_UNKNOWN");
  }
  if (input.language !== "en" && input.language !== "zh-Hant") {
    return failure("PERSONA_BEHAVIOR_LANGUAGE_UNKNOWN");
  }
  if (!isProfileValid(input)) return failure("PERSONA_BEHAVIOR_PROFILE_INVALID");

  const role = ROLE_CONTRACTS[input.roleCode];
  const safetyOverride = input.safetyMode === "safety_override";
  const behaviorModifiers: string[] = [];
  if (!safetyOverride) {
    for (const factor of input.calculatedProfile) {
      const row = PERSONA_BEHAVIOR_MAPPING_V1.find(
        (candidate) => candidate.factor === factor.factor && candidate.signNumber === factor.signNumber && candidate.sign === factor.sign
      );
      if (!row) return failure("PERSONA_BEHAVIOR_MAPPING_MISSING");
      behaviorModifiers.push(row.promptReadyModifier);
    }
  }

  return {
    ok: true,
    value: {
      assemblerVersion: "v1",
      ruleVersions: { persona: "v1", mapping: "v1" },
      priorityOrder: PRIORITY_ORDER,
      safetyOverride,
      roleContract: {
        publicName: role.publicName,
        corePurpose: role.corePurpose,
        requiredBehaviors: role.requiredBehaviors,
        baseTone: role.baseTone,
        hardGuardrail: role.hardGuardrail,
      },
      situationParameters: situationParameters(input.emotionalState),
      calculatedProfile: input.calculatedProfile.map((factor) => ({ ...factor })),
      behaviorModifiers,
      sourceRulesApplied: [...input.sourceRulesApplied],
      language: input.language,
      responseInstruction: safetyOverride
        ? "Use the approved safety workflow and suppress conflicting persona behaviour."
        : "Respond naturally; do not mention internal calculations or mapping IDs.",
    },
  };
}

export function assemblePersonaBehaviorPromptFromCalculation(
  calculation: unknown,
  context: unknown
): PersonaBehaviorAssemblyResult {
  if (isChartUnavailable(calculation)) return failure("customer_chart_unavailable");
  if (!isCalculationSuccess(calculation) || !isPromptContext(context)) {
    return failure("PERSONA_BEHAVIOR_INPUT_INVALID");
  }
  return assemblePersonaBehaviorPrompt({
    ...context,
    roleCode: calculation.roleCode,
    ruleVersion: calculation.ruleVersion,
    calculatedProfile: calculation.calculatedProfile.map(({ factor, signNumber, sign }) => ({ factor, signNumber, sign })),
    sourceRulesApplied: calculation.sourceRulesApplied,
  });
}

function situationParameters(state: PersonaEmotionalState): PersonaBehaviorPromptPayload["situationParameters"] {
  if (state === "acute_distress") {
    return { pace: "slow", humour: "paused", challenge: "paused", advice: "minimal", responseLength: "shorter" };
  }
  if (state === "heightened_distress") {
    return { pace: "slower", humour: "paused", challenge: "gentle", advice: "by_consent", responseLength: "shorter" };
  }
  return { pace: "normal", humour: "role_default", challenge: "role_default", advice: "by_consent", responseLength: "normal" };
}

function isClosedInput(value: unknown): value is PersonaBehaviorAssemblyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["assemblerVersion", "ruleVersion", "mappingVersion", "roleCode", "safetyMode", "emotionalState", "calculatedProfile", "sourceRulesApplied", "language"];
  const sourceRules = record.sourceRulesApplied;
  const profile = record.calculatedProfile;
  return Object.keys(record).length === keys.length && keys.every((key) => key in record) &&
    typeof record.assemblerVersion === "string" && typeof record.ruleVersion === "string" &&
    typeof record.mappingVersion === "string" && typeof record.roleCode === "string" &&
    typeof record.language === "string" &&
    (record.safetyMode === "standard" || record.safetyMode === "safety_override") &&
    (record.emotionalState === "steady" || record.emotionalState === "heightened_distress" || record.emotionalState === "acute_distress") &&
    Array.isArray(profile) && profile.every(isClosedResolvedFactor) &&
    Array.isArray(sourceRules) && sourceRules.every(isSourceRuleCode);
}

function isClosedResolvedFactor(value: unknown): value is ResolvedFactor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 3 && "factor" in record && "signNumber" in record && "sign" in record &&
    (record.factor === "ASC" || record.factor === "Sun" || record.factor === "Moon" || record.factor === "Mercury" || record.factor === "Saturn") &&
    typeof record.signNumber === "number" && typeof record.sign === "string";
}

function isProfileValid(input: PersonaBehaviorAssemblyInput): boolean {
  const role = ROLE_CONTRACTS[input.roleCode];
  const factors = input.calculatedProfile;
  if (factors.length !== role.factors.length) return false;
  if (new Set(factors.map((factor) => factor.factor)).size !== factors.length) return false;
  if (!factors.every((factor) => role.factors.includes(factor.factor as never) && Number.isInteger(factor.signNumber) && factor.signNumber >= 1 && factor.signNumber <= 12 && typeof factor.sign === "string")) return false;
  if (!role.factors.every((factor) => factors.some((entry) => entry.factor === factor))) return false;
  const allowedRule: Record<PersonaRoleCode, PersonaSourceRuleCode> = {
    empathetic_peer: "acceptance_moon_from_customer_sun",
    harmonious_catalyst: "spark_moon_from_customer_sun_trine",
    saturnian_anchor: "awareness_saturn_from_customer_sun_sextile",
  };
  return input.sourceRulesApplied.length <= 1 &&
    (input.sourceRulesApplied.length === 0 || input.sourceRulesApplied[0] === allowedRule[input.roleCode]);
}

function isSourceRuleCode(value: unknown): value is PersonaSourceRuleCode {
  return value === "acceptance_moon_from_customer_sun" ||
    value === "spark_moon_from_customer_sun_trine" ||
    value === "awareness_saturn_from_customer_sun_sextile";
}

function isChartUnavailable(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    (value as Record<string, unknown>).ok === false &&
    (value as Record<string, unknown>).code === "customer_chart_unavailable" &&
    (value as Record<string, unknown>).action === "stop_persona_generation_and_retry");
}

function isCalculationSuccess(value: unknown): value is {
  ok: true;
  ruleVersion: "v1";
  roleCode: PersonaRoleCode;
  calculatedProfile: Array<ResolvedFactor & Record<string, unknown>>;
  sourceRulesApplied: PersonaSourceRuleCode[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.ok === true && record.ruleVersion === "v1" &&
    (record.roleCode === "empathetic_peer" || record.roleCode === "harmonious_catalyst" || record.roleCode === "saturnian_anchor") &&
    Array.isArray(record.calculatedProfile) && record.calculatedProfile.every((factor) => {
      if (!factor || typeof factor !== "object" || Array.isArray(factor)) return false;
      const item = factor as Record<string, unknown>;
      return isClosedResolvedFactor({ factor: item.factor, signNumber: item.signNumber, sign: item.sign });
    }) && Array.isArray(record.sourceRulesApplied) && record.sourceRulesApplied.every(isSourceRuleCode);
}

function isPromptContext(value: unknown): value is Omit<PersonaBehaviorAssemblyInput, "roleCode" | "ruleVersion" | "calculatedProfile" | "sourceRulesApplied"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["assemblerVersion", "mappingVersion", "safetyMode", "emotionalState", "language"];
  return Object.keys(record).length === keys.length && keys.every((key) => key in record) &&
    record.assemblerVersion === "v1" && record.mappingVersion === "v1" &&
    (record.safetyMode === "standard" || record.safetyMode === "safety_override") &&
    (record.emotionalState === "steady" || record.emotionalState === "heightened_distress" || record.emotionalState === "acute_distress") &&
    (record.language === "en" || record.language === "zh-Hant");
}

function failure(code: PersonaBehaviorFailureCode): PersonaBehaviorAssemblyResult {
  return { ok: false, error: { code } };
}
