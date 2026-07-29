export type { ChartWorkerBirthData, SignedChartWorkerRequest } from "./chart-worker-contract";
export { CHART_WORKER_CONTRACT } from "./chart-worker-contract";

export type ProfileChartDraft = {
  display_name: string;
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
};

export function buildProfileChartDraft(input: {
  name: string;
  birthDate: string;
  birthTime: string;
  timeUnknown?: boolean;
  birthPlace: string;
}): ProfileChartDraft {
  return {
    display_name: input.name.trim(),
    birth_date: input.birthDate.trim(),
    birth_time: input.timeUnknown ? null : input.birthTime.trim(),
    time_unknown: input.timeUnknown ?? false,
    place_name: input.birthPlace.trim()
  };
}

export {
  decideProfilePreflight,
  type ProfilePreflightDecision,
  type ProfilePreflightState
} from "./profile-preflight";
export { buildSafeAiChartContext, sanitizeChartForClient } from "./chart-sanitizer";
export {
  buildSafeChatChartContext,
  type SafeChatChartContext
} from "./chat-chart-context";
export { allowsFixtureFallbackForEnvironment } from "./chart-worker-config";
export {
  NATAL_FACT_RULE_VERSION,
  canonicalizeNatalPointKey,
  canonicalizeZodiacSign,
  deriveMoonSignFromLocalDayEndpoints,
  deriveTimedNatalFact,
  deriveTraditionalChartRuler,
  deriveTraditionalHouseRuler,
  isCanonicalNatalAngleKey,
  resolveBirthTimeAvailability,
  resolveBirthTimeCapabilities,
  traditionalRulerForSign,
  type BirthTimeAvailability,
  type BirthTimeCapabilities,
  type CanonicalNatalAngleKey,
  type CanonicalNatalBodyKey,
  type CanonicalNatalPointKey,
  type CanonicalZodiacSign,
  type NatalDerivedFact,
  type NatalFactCapabilityRequirement,
  type NatalFactReason,
  type TimedNatalCapability,
} from "./natal-facts";
export {
  NATAL_ASPECT_RULES,
  circularAngularDistance,
  deriveNatalAspects,
  normalizeNatalLongitude,
  type NatalAspectPointInput,
  type NatalAspectType,
  type NatalAspectValue,
} from "./natal-aspects";
export {
  NATAL_INPUT_CONTRACT_VERSION,
  validateNatalEngineInput,
  type CanonicalNatalEngineInput,
  type CanonicalNatalInputHouse,
  type CanonicalNatalInputPoint,
  type NatalInputBoundaryResult,
  type NatalInputFailure,
  type NatalInputFailureCode,
  type NatalInputFailureLocation,
  type NatalInputFailureReason,
} from "./natal-input-boundary";
