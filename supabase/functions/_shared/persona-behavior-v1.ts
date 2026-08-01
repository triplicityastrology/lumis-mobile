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

export type PersonaBehaviorAssemblyInput = {
  assemblerVersion: typeof PERSONA_BEHAVIOR_ASSEMBLER_VERSION;
  ruleVersion: "v1";
  mappingVersion: typeof PERSONA_BEHAVIOR_MAPPING_VERSION;
  roleCode: PersonaRoleCode;
  safetyMode: PersonaSafetyMode;
  emotionalState: PersonaEmotionalState;
  calculatedProfile: ResolvedFactor[];
  fallbacksApplied: Array<"neutral_emotional_attunement" | "stable_boundary">;
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
  fallbacksApplied: Array<"neutral_emotional_attunement" | "stable_boundary">;
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
    factors: ["ASC", "Sun", "Mercury"],
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
      fallbacksApplied: [...input.fallbacksApplied],
      language: input.language,
      responseInstruction: safetyOverride
        ? "Use the approved safety workflow and suppress conflicting persona behaviour."
        : "Respond naturally; do not mention internal calculations or mapping IDs.",
    },
  };
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
  const keys = ["assemblerVersion", "ruleVersion", "mappingVersion", "roleCode", "safetyMode", "emotionalState", "calculatedProfile", "fallbacksApplied", "language"];
  const fallbacks = record.fallbacksApplied;
  const profile = record.calculatedProfile;
  return Object.keys(record).length === keys.length && keys.every((key) => key in record) &&
    typeof record.assemblerVersion === "string" && typeof record.ruleVersion === "string" &&
    typeof record.mappingVersion === "string" && typeof record.roleCode === "string" &&
    typeof record.language === "string" &&
    (record.safetyMode === "standard" || record.safetyMode === "safety_override") &&
    (record.emotionalState === "steady" || record.emotionalState === "heightened_distress" || record.emotionalState === "acute_distress") &&
    Array.isArray(profile) && profile.every(isClosedResolvedFactor) &&
    Array.isArray(fallbacks) && fallbacks.every((fallback) => fallback === "neutral_emotional_attunement" || fallback === "stable_boundary");
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
  if (factors.length < role.factors.length - 1 || factors.length > role.factors.length) return false;
  if (new Set(factors.map((factor) => factor.factor)).size !== factors.length) return false;
  if (!factors.every((factor) => role.factors.includes(factor.factor as never) && Number.isInteger(factor.signNumber) && factor.signNumber >= 1 && factor.signNumber <= 12 && typeof factor.sign === "string")) return false;
  const required = role.factors.filter((factor) => factor !== "Moon" && factor !== "Saturn");
  if (!required.every((factor) => factors.some((entry) => entry.factor === factor))) return false;
  const fallback = input.roleCode === "empathetic_peer" ? "neutral_emotional_attunement" : input.roleCode === "saturnian_anchor" ? "stable_boundary" : null;
  const optionalFactor = input.roleCode === "empathetic_peer" ? "Moon" : input.roleCode === "saturnian_anchor" ? "Saturn" : null;
  const fallbackExpected = optionalFactor != null && !factors.some((entry) => entry.factor === optionalFactor);
  return fallback == null
    ? input.fallbacksApplied.length === 0
    : input.fallbacksApplied.length === (fallbackExpected ? 1 : 0) && (!fallbackExpected || input.fallbacksApplied[0] === fallback);
}

function failure(code: PersonaBehaviorFailureCode): PersonaBehaviorAssemblyResult {
  return { ok: false, error: { code } };
}
