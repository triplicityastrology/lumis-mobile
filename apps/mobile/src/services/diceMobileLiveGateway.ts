import type { DiceLiveResultState } from "./diceLiveResultAdapter";
import {
  DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
  resolveDiceFounderFixtureByExactText,
} from "./diceFounderFixtureRegistry";
import type {
  DiceCustomerInterpretationEnvelope,
  DiceCustomerInterpretationInput,
} from "./diceCustomerInterpretationController";

export const DICE_MOBILE_LIVE_GATEWAY_VERSION = "dice_mobile_live_gateway_v1" as const;
export const DICE_TECHNICAL_80_METADATA_RECEIPT_SHA256 = "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612" as const;
export const DICE_RUNTIME_PACKAGE_SHA256 = "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" as const;
export const DICE_MICROSOFT_CONTRACT_COMMIT = "c1ec632fdea1f2677621f8b1bd3a71e72d17f071" as const;
export const DICE_MICROSOFT_CONTRACT_SEAL_SHA256 = "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c" as const;
export const DICE_PROMPT_VERSION = "lumis_dice_v0_3_prompt_v2" as const;
export const DICE_RESULT_SCHEMA = "lumis_dice_v0_3_result_v2" as const;

// Technical-80 is accepted, but no separate Founder live-window receipt is.
// A reviewed follow-up must pin that exact evidence digest before transport can exist.
export const ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256: string | null = null;

const NO_EFFECTS = Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 });
const PLANETS = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"]);
const SIGNS = new Set(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
const HOUSES = new Set(Array.from({ length: 12 }, (_, index) => `house_${index + 1}`));

export type DiceMobileGatewayRequest = Readonly<{
  fixture_id: string;
  planet_id: string;
  sign_id: string;
  house_id: string;
}>;

export type DiceMobileLiveEvidence = Readonly<{
  schema: "lumis_dice_founder_mobile_live_evidence_v1";
  status: "accepted";
  technical_80_metadata_receipt_sha256: typeof DICE_TECHNICAL_80_METADATA_RECEIPT_SHA256;
  runtime_package_sha256: typeof DICE_RUNTIME_PACKAGE_SHA256;
  microsoft_contract_commit: typeof DICE_MICROSOFT_CONTRACT_COMMIT;
  microsoft_contract_seal_sha256: typeof DICE_MICROSOFT_CONTRACT_SEAL_SHA256;
  prompt_version: typeof DICE_PROMPT_VERSION;
  result_schema: typeof DICE_RESULT_SCHEMA;
  founder_window_evidence_sha256: string;
  fixture_registry_sha256: typeof DICE_FOUNDER_FIXTURE_REGISTRY_SHA256;
}>;

export type DiceMobileLiveConfig = Readonly<{
  ai_enabled: boolean;
  traffic_authorized: boolean;
  evidence: DiceMobileLiveEvidence | null;
  accepted_founder_window_evidence_sha256?: string | null;
  create_transport?: () => (request: DiceMobileGatewayRequest) => Promise<unknown>;
}>;

export function readDiceMobileLiveConfig(): DiceMobileLiveConfig {
  const suppliedDigest = process.env.EXPO_PUBLIC_DICE_FOUNDER_WINDOW_EVIDENCE_SHA256;
  const evidence = ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256 && suppliedDigest === ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256
    ? acceptedEvidence(suppliedDigest)
    : null;
  return Object.freeze({
    ai_enabled: process.env.EXPO_PUBLIC_DICE_AI_ENABLED === "1",
    traffic_authorized: process.env.EXPO_PUBLIC_DICE_TRAFFIC_AUTHORIZED === "1",
    evidence,
    accepted_founder_window_evidence_sha256: ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256,
  });
}

export function createDiceMobileLiveController(config: DiceMobileLiveConfig) {
  return Object.freeze({
    request: async (
      input: DiceCustomerInterpretationInput,
      onState: (envelope: DiceCustomerInterpretationEnvelope) => void,
    ): Promise<void> => {
      const fixture = resolveDiceFounderFixtureByExactText(input.question);
      if (!fixture || !closedLanding(input)) {
        emit(onState, input.request_key, { kind: "retry", language: fixture?.language ?? "en", code: "DICE_REQUEST_SCHEMA_INVALID", effects: NO_EFFECTS });
        return;
      }
      if (!config.ai_enabled || !config.traffic_authorized) {
        emit(onState, input.request_key, { kind: "disabled", code: "DICE_AI_DISABLED", effects: NO_EFFECTS });
        return;
      }
      if (!acceptedLiveEvidence(config.evidence, config.accepted_founder_window_evidence_sha256 ?? ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256)) {
        emit(onState, input.request_key, { kind: "disabled", code: "DICE_LIVE_AUTHORITY_REQUIRED", effects: NO_EFFECTS });
        return;
      }

      emit(onState, input.request_key, { kind: "loading", language: fixture.language, effects: NO_EFFECTS });
      const transport = config.create_transport?.();
      if (!transport) {
        emit(onState, input.request_key, retry(fixture.language, "DICE_GATEWAY_UNAVAILABLE"));
        return;
      }
      try {
        const result = projectResult(await transport({
          fixture_id: fixture.fixture_id,
          planet_id: input.planet_id,
          sign_id: input.sign_id,
          house_id: input.house_id,
        }), fixture.language);
        emit(onState, input.request_key, result);
      } catch {
        emit(onState, input.request_key, retry(fixture.language, "DICE_GATEWAY_UNAVAILABLE"));
      }
    },
  });
}

export function acceptedLiveEvidence(evidence: DiceMobileLiveEvidence | null, acceptedDigest = ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256): evidence is DiceMobileLiveEvidence {
  return acceptedDigest !== null
    && evidence?.schema === "lumis_dice_founder_mobile_live_evidence_v1"
    && evidence.status === "accepted"
    && evidence.technical_80_metadata_receipt_sha256 === DICE_TECHNICAL_80_METADATA_RECEIPT_SHA256
    && evidence.runtime_package_sha256 === DICE_RUNTIME_PACKAGE_SHA256
    && evidence.microsoft_contract_commit === DICE_MICROSOFT_CONTRACT_COMMIT
    && evidence.microsoft_contract_seal_sha256 === DICE_MICROSOFT_CONTRACT_SEAL_SHA256
    && evidence.prompt_version === DICE_PROMPT_VERSION
    && evidence.result_schema === DICE_RESULT_SCHEMA
    && evidence.founder_window_evidence_sha256 === acceptedDigest
    && evidence.fixture_registry_sha256 === DICE_FOUNDER_FIXTURE_REGISTRY_SHA256;
}

function acceptedEvidence(digest: string): DiceMobileLiveEvidence {
  return Object.freeze({
    schema: "lumis_dice_founder_mobile_live_evidence_v1",
    status: "accepted",
    technical_80_metadata_receipt_sha256: DICE_TECHNICAL_80_METADATA_RECEIPT_SHA256,
    runtime_package_sha256: DICE_RUNTIME_PACKAGE_SHA256,
    microsoft_contract_commit: DICE_MICROSOFT_CONTRACT_COMMIT,
    microsoft_contract_seal_sha256: DICE_MICROSOFT_CONTRACT_SEAL_SHA256,
    prompt_version: DICE_PROMPT_VERSION,
    result_schema: DICE_RESULT_SCHEMA,
    founder_window_evidence_sha256: digest,
    fixture_registry_sha256: DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
  });
}

function closedLanding(input: DiceCustomerInterpretationInput): boolean {
  return PLANETS.has(input.planet_id) && SIGNS.has(input.sign_id) && HOUSES.has(input.house_id);
}

function projectResult(value: unknown, language: "en" | "zh-Hant"): DiceLiveResultState {
  if (!record(value)) return retry(language, "DICE_RESPONSE_INVALID");
  const normalKeys = ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "timing_or_pace", "judgment", "practical_direction"];
  if (exactKeys(value, normalKeys) && value.schema === DICE_RESULT_SCHEMA && value.language === language) {
    const layers = [value.planet_layer, value.sign_element_layer, value.house_layer];
    if (!layers.every((item) => bounded(item, 540)) || !nullableBounded(value.timing_or_pace, 540) || !nullableBounded(value.judgment, 540) || !bounded(value.practical_direction, 540)) {
      return retry(language, "DICE_RESPONSE_INVALID");
    }
    return {
      kind: "interpretation",
      language,
      reading: [...layers, value.timing_or_pace].filter((item): item is string => typeof item === "string").join(language === "zh-Hant" ? "" : " "),
      watch_out: typeof value.judgment === "string" ? value.judgment : value.house_layer as string,
      practical_direction: value.practical_direction,
      effects: NO_EFFECTS,
    };
  }

  const outcomeKeys = ["schema", "result", "language", "message", "effects"];
  if (!exactKeys(value, outcomeKeys) || value.schema !== "lumis_dice_mobile_result_v1" || value.language !== language || !bounded(value.message, 500) || !zeroEffects(value.effects)) {
    return retry(language, "DICE_RESPONSE_INVALID");
  }
  if (value.result === "safety_redirect") return { kind: "safety", language, message: value.message, effects: NO_EFFECTS };
  if (value.result === "fixed_fallback") return { kind: "fallback", language, message: value.message, effects: NO_EFFECTS };
  return retry(language, "DICE_RESPONSE_INVALID");
}

function emit(onState: (envelope: DiceCustomerInterpretationEnvelope) => void, requestKey: string, state: DiceLiveResultState): void {
  onState({ request_key: requestKey, state });
}

function retry(language: "en" | "zh-Hant", code: string): DiceLiveResultState {
  return { kind: "retry", language, code, effects: NO_EFFECTS };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function bounded(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && [...value].length <= maximum;
}

function nullableBounded(value: unknown, maximum: number): boolean {
  return value === null || bounded(value, maximum);
}

function zeroEffects(value: unknown): boolean {
  return record(value) && exactKeys(value, ["persistence_writes", "units_charged"])
    && value.persistence_writes === 0 && value.units_charged === 0;
}
