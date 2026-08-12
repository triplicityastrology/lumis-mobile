import {
  classifyDiceQuestionRequest,
  type DiceLanguage,
} from "../../../../packages/shared/src/config/dice-question-boundary";
import {
  DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
  resolveDiceFounderFixture,
} from "./diceFounderFixtureRegistry";

export const DICE_LIVE_RESULT_ADAPTER_VERSION = "dice_live_result_adapter_v1" as const;
export const DICE_V4_RUNTIME_PACKAGE_SHA256 = "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" as const;
export const DICE_V4_AUTHORIZATION_PACKAGE_SHA256 = "275d08c3d04f1408b93d4bcc32f90412d2567a7edd9b3eeb0654fad4393138db" as const;
export const DICE_V4_ZERO_CALL_PACKAGE_SHA256 = "af35103c94e1acdc88f346fd926c9459fa262c1222eec87b03dc0777a9613e80" as const;

const NO_EFFECTS = Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 });
const RESPONSE_KEYS = new Set([
  "version", "result", "language", "code", "reading", "watch_out",
  "practical_direction", "message", "effects",
]);

export type DiceLiveAuthority = Readonly<{
  schema: "lumis_dice_mobile_live_result_authority_v1";
  deployment_authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4";
  runtime_package_sha256: typeof DICE_V4_RUNTIME_PACKAGE_SHA256;
  authorization_package_sha256: typeof DICE_V4_AUTHORIZATION_PACKAGE_SHA256;
  zero_call_package_sha256: typeof DICE_V4_ZERO_CALL_PACKAGE_SHA256;
  operational_receipt_status: "accepted";
  fixture_registry_status: "accepted";
  fixture_registry_sha256: typeof DICE_FOUNDER_FIXTURE_REGISTRY_SHA256;
}>;

export type DiceLiveResultState =
  | Readonly<{ kind: "disabled"; code: "DICE_AI_DISABLED" | "DICE_LIVE_AUTHORITY_REQUIRED"; effects: typeof NO_EFFECTS }>
  | Readonly<{ kind: "validation"; code: string; effects: typeof NO_EFFECTS }>
  | Readonly<{ kind: "loading"; language: DiceLanguage; effects: typeof NO_EFFECTS }>
  | Readonly<{ kind: "interpretation"; language: DiceLanguage; reading: string; watch_out: string; practical_direction: string; effects: typeof NO_EFFECTS }>
  | Readonly<{ kind: "safety"; language: DiceLanguage; message: string; effects: typeof NO_EFFECTS }>
  | Readonly<{ kind: "fallback"; language: DiceLanguage; message: string; effects: typeof NO_EFFECTS }>
  | Readonly<{ kind: "retry"; language: DiceLanguage; code: string; effects: typeof NO_EFFECTS }>;

type GatewayTransport = (request: Readonly<{ fixture_id: string }>) => Promise<unknown>;

export type DiceLiveResultAdapterConfig = Readonly<{
  ai_enabled: boolean;
  traffic_authorized: boolean;
  authority: DiceLiveAuthority | null;
  create_gateway_transport?: () => GatewayTransport;
}>;

export type DiceLiveResultRequest = Readonly<{
  fixture_id: string;
  question: string;
  on_state?: (state: DiceLiveResultState) => void;
}>;

export function createDiceLiveResultAdapter(config: DiceLiveResultAdapterConfig) {
  return Object.freeze({
    request: async (request: DiceLiveResultRequest): Promise<DiceLiveResultState> => {
      const decision = classifyDiceQuestionRequest({ question: request.question });
      if (!decision.accepted) return emit(request, { kind: "validation", code: decision.code, effects: NO_EFFECTS });

      if (!config.ai_enabled || !config.traffic_authorized) {
        return emit(request, { kind: "disabled", code: "DICE_AI_DISABLED", effects: NO_EFFECTS });
      }
      if (!isAcceptedAuthority(config.authority)) {
        return emit(request, { kind: "disabled", code: "DICE_LIVE_AUTHORITY_REQUIRED", effects: NO_EFFECTS });
      }
      const fixture = resolveDiceFounderFixture(request.fixture_id);
      if (!fixture || fixture.exact_text !== request.question) {
        return emit(request, { kind: "validation", code: "DICE_FIXTURE_ID_INVALID", effects: NO_EFFECTS });
      }

      emit(request, { kind: "loading", language: decision.language, effects: NO_EFFECTS });
      const transport = config.create_gateway_transport?.();
      if (!transport) return emit(request, { kind: "retry", language: decision.language, code: "DICE_GATEWAY_UNAVAILABLE", effects: NO_EFFECTS });

      try {
        return emit(request, projectGatewayResult(await transport({ fixture_id: request.fixture_id }), decision.language));
      } catch {
        return emit(request, { kind: "retry", language: decision.language, code: "DICE_GATEWAY_UNAVAILABLE", effects: NO_EFFECTS });
      }
    },
  });
}

function isAcceptedAuthority(authority: DiceLiveAuthority | null): authority is DiceLiveAuthority {
  return authority?.schema === "lumis_dice_mobile_live_result_authority_v1"
    && authority.deployment_authorization_schema === "lumis_dice_default_off_function_deployment_authorization_v4"
    && authority.runtime_package_sha256 === DICE_V4_RUNTIME_PACKAGE_SHA256
    && authority.authorization_package_sha256 === DICE_V4_AUTHORIZATION_PACKAGE_SHA256
    && authority.zero_call_package_sha256 === DICE_V4_ZERO_CALL_PACKAGE_SHA256
    && authority.operational_receipt_status === "accepted"
    && authority.fixture_registry_status === "accepted"
    && authority.fixture_registry_sha256 === DICE_FOUNDER_FIXTURE_REGISTRY_SHA256;
}

function projectGatewayResult(value: unknown, expectedLanguage: DiceLanguage): DiceLiveResultState {
  if (!isRecord(value) || Object.keys(value).some((key) => !RESPONSE_KEYS.has(key))) return retry(expectedLanguage, "DICE_RESPONSE_INVALID");
  if (value.version !== "dice_interpretation_response_v0_3" || value.language !== expectedLanguage || !validCode(value.code) || !zeroEffect(value.effects)) {
    return retry(expectedLanguage, "DICE_RESPONSE_INVALID");
  }
  if (value.result === "completed" && bounded(value.reading, 600) && bounded(value.watch_out, 600) && bounded(value.practical_direction, 600) && value.message === undefined) {
    return { kind: "interpretation", language: expectedLanguage, reading: value.reading, watch_out: value.watch_out, practical_direction: value.practical_direction, effects: NO_EFFECTS };
  }
  if (value.result === "safety_redirect" && bounded(value.message, 500) && interpretationFieldsAbsent(value)) {
    return { kind: "safety", language: expectedLanguage, message: value.message, effects: NO_EFFECTS };
  }
  if (value.result === "fixed_fallback" && bounded(value.message, 500) && interpretationFieldsAbsent(value)) {
    return { kind: "fallback", language: expectedLanguage, message: value.message, effects: NO_EFFECTS };
  }
  if (value.result === "technical_error" && value.message === undefined && interpretationFieldsAbsent(value)) {
    return retry(expectedLanguage, value.code);
  }
  return retry(expectedLanguage, "DICE_RESPONSE_INVALID");
}

function retry(language: DiceLanguage, code: string): DiceLiveResultState {
  return { kind: "retry", language, code, effects: NO_EFFECTS };
}

function emit(request: DiceLiveResultRequest, state: DiceLiveResultState): DiceLiveResultState {
  request.on_state?.(state);
  return state;
}

function bounded(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && [...value].length <= maximum;
}

function zeroEffect(value: unknown): boolean {
  return isRecord(value)
    && Object.keys(value).length === 2
    && value.persistence_writes === 0
    && value.units_charged === 0;
}

function validCode(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && /^DICE_[A-Z0-9_]+$/u.test(value);
}

function interpretationFieldsAbsent(value: Record<string, unknown>): boolean {
  return value.reading === undefined && value.watch_out === undefined && value.practical_direction === undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
