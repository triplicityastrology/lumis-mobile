import {
  DICE_V4_AUTHORIZATION_PACKAGE_SHA256,
  DICE_V4_RUNTIME_PACKAGE_SHA256,
  DICE_V4_ZERO_CALL_PACKAGE_SHA256,
  createDiceLiveResultAdapter,
  type DiceLiveAuthority,
  type DiceLiveResultState,
} from "./diceLiveResultAdapter";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const authority: DiceLiveAuthority = Object.freeze({
  schema: "lumis_dice_mobile_live_result_authority_v1",
  deployment_authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  runtime_package_sha256: DICE_V4_RUNTIME_PACKAGE_SHA256,
  authorization_package_sha256: DICE_V4_AUTHORIZATION_PACKAGE_SHA256,
  zero_call_package_sha256: DICE_V4_ZERO_CALL_PACKAGE_SHA256,
  operational_receipt_status: "accepted",
  fixture_registry_status: "accepted",
});

let constructions = 0;
let calls = 0;
const createTransport = () => {
  constructions += 1;
  return async ({ fixture_id }: Readonly<{ fixture_id: string }>) => {
    calls += 1;
    check(fixture_id === "dice-founder-en-01", "gateway receives fixture_id only");
    return {
      version: "dice_interpretation_response_v0_3",
      result: "completed",
      language: "en",
      code: "DICE_COMPLETED",
      reading: "A bounded synthetic reading.",
      watch_out: "Stay open to context.",
      practical_direction: "Choose one grounded next step.",
      effects: { persistence_writes: 0, units_charged: 0 },
    };
  };
};

async function main() {
  for (const config of [
    { ai_enabled: false, traffic_authorized: false, authority: null },
    { ai_enabled: true, traffic_authorized: false, authority },
    { ai_enabled: false, traffic_authorized: true, authority },
    { ai_enabled: true, traffic_authorized: true, authority: null },
  ] as const) {
    const state = await createDiceLiveResultAdapter({ ...config, create_gateway_transport: createTransport }).request({ fixture_id: "dice-founder-en-01", question: "What should I notice about this job?" });
    check(state.kind === "disabled", "incomplete gates fail closed");
  }
  check(constructions === 0 && calls === 0, "gateway cannot be constructed before both switches and authority");

  const rejected = await createDiceLiveResultAdapter({ ai_enabled: true, traffic_authorized: true, authority, create_gateway_transport: createTransport }).request({
    fixture_id: "dice-founder-zh-08",
    question: "我個application 會唔會批？幾時會批？",
  });
  check(rejected.kind === "validation" && rejected.code === "DICE_QUESTION_BUNDLED", "ZH08 remains bundled rejection");
  check(constructions === 0 && calls === 0, "validation stops before gateway construction");

  const states: DiceLiveResultState[] = [];
  const completed = await createDiceLiveResultAdapter({ ai_enabled: true, traffic_authorized: true, authority, create_gateway_transport: createTransport }).request({
    fixture_id: "dice-founder-en-01",
    question: "What should I notice about this job?",
    on_state: (state) => states.push(state),
  });
  check(states[0]?.kind === "loading" && completed.kind === "interpretation", "accepted request projects loading then interpretation");
  check(Number(constructions) === 1 && Number(calls) === 1, "accepted gates construct and call once");

  const hostile = await createDiceLiveResultAdapter({
    ai_enabled: true,
    traffic_authorized: true,
    authority,
    create_gateway_transport: () => async () => ({
      version: "dice_interpretation_response_v0_3",
      result: "completed",
      language: "en",
      code: "DICE_COMPLETED",
      reading: "safe",
      watch_out: "safe",
      practical_direction: "safe",
      effects: { persistence_writes: 0, units_charged: 0 },
      raw_provider_envelope: "must not project",
    }),
  }).request({ fixture_id: "dice-founder-en-01", question: "What should I notice about this job?" });
  check(hostile.kind === "retry" && hostile.code === "DICE_RESPONSE_INVALID", "unknown/raw fields fail closed");

  const mixed = await createDiceLiveResultAdapter({
    ai_enabled: true,
    traffic_authorized: true,
    authority,
    create_gateway_transport: () => async () => ({
      version: "dice_interpretation_response_v0_3",
      result: "fixed_fallback",
      language: "en",
      code: "DICE_FIXED_FALLBACK",
      message: "Please try again.",
      reading: "must not coexist",
      effects: { persistence_writes: 0, units_charged: 0 },
    }),
  }).request({ fixture_id: "dice-founder-en-01", question: "What should I notice about this job?" });
  check(mixed.kind === "retry" && mixed.code === "DICE_RESPONSE_INVALID", "result-specific field mixing fails closed");

  for (const [result, expectedKind, message] of [
    ["safety_redirect", "safety", "Use a safer general reflection."],
    ["fixed_fallback", "fallback", "Please try again."],
  ] as const) {
    const state = await createDiceLiveResultAdapter({
      ai_enabled: true,
      traffic_authorized: true,
      authority,
      create_gateway_transport: () => async () => ({
        version: "dice_interpretation_response_v0_3",
        result,
        language: "en",
        code: result === "safety_redirect" ? "DICE_SAFETY_REDIRECT" : "DICE_FIXED_FALLBACK",
        message,
        effects: { persistence_writes: 0, units_charged: 0 },
      }),
    }).request({ fixture_id: "dice-founder-en-02", question: "What should I notice about this situation?" });
    check(state.kind === expectedKind, `${result} projects ${expectedKind}`);
  }

  const retry = await createDiceLiveResultAdapter({
    ai_enabled: true,
    traffic_authorized: true,
    authority,
    create_gateway_transport: () => async () => ({
      version: "dice_interpretation_response_v0_3",
      result: "technical_error",
      language: "en",
      code: "DICE_PROVIDER_TIMEOUT",
      effects: { persistence_writes: 0, units_charged: 0 },
    }),
  }).request({ fixture_id: "dice-founder-en-03", question: "What should I notice about this situation?" });
  check(retry.kind === "retry" && retry.code === "DICE_PROVIDER_TIMEOUT", "technical error projects retry without raw diagnostics");

  const zh09 = await createDiceLiveResultAdapter({ ai_enabled: false, traffic_authorized: false, authority: null }).request({
    fixture_id: "dice-founder-zh-09",
    question: "我個application幾時會批？",
  });
  check(zh09.kind === "disabled", "ZH09 remains an accepted single question and reaches the disabled live gate");

  console.log("S2-T302 Dice live-result adapter fixtures passed");
}

void main();
