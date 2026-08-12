import {
  DICE_V4_AUTHORIZATION_PACKAGE_SHA256,
  DICE_V4_RUNTIME_PACKAGE_SHA256,
  DICE_V4_ZERO_CALL_PACKAGE_SHA256,
  createDiceLiveResultAdapter,
  type DiceLiveAuthority,
  type DiceLiveResultState,
} from "./diceLiveResultAdapter";
import {
  DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
  DICE_FOUNDER_FIXTURES,
  resolveDiceFounderFixtureByAuthoringId,
} from "./diceFounderFixtureRegistry";

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
  fixture_registry_sha256: DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
});

function fixture(authoringId: string) {
  const value = resolveDiceFounderFixtureByAuthoringId(authoringId);
  check(value, `missing approved fixture ${authoringId}`);
  return value;
}

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
  check(DICE_FOUNDER_FIXTURES.length === 40, "sealed registry contains exactly 40 fixtures");
  check(DICE_FOUNDER_FIXTURES.filter((fixture) => fixture.language === "en").length === 20, "registry contains 20 EN fixtures");
  check(DICE_FOUNDER_FIXTURES.filter((fixture) => fixture.language === "zh-Hant").length === 20, "registry contains 20 zh-Hant fixtures");
  check(!DICE_FOUNDER_FIXTURES.some((fixture) => fixture.authoring_id === "ZH04" || fixture.exact_text === "我去到澳洲應該讀書定係做嘢？"), "ZH04 is excluded exactly");

  for (const config of [
    { ai_enabled: false, traffic_authorized: false, authority: null },
    { ai_enabled: true, traffic_authorized: false, authority },
    { ai_enabled: false, traffic_authorized: true, authority },
    { ai_enabled: true, traffic_authorized: true, authority: null },
  ] as const) {
    const state = await createDiceLiveResultAdapter({ ...config, create_gateway_transport: createTransport }).request({ fixture_id: fixture("EN01").fixture_id, question: fixture("EN01").exact_text });
    check(state.kind === "disabled", "incomplete gates fail closed");
  }
  check(constructions === 0 && calls === 0, "gateway cannot be constructed before both switches and authority");

  const rejected = await createDiceLiveResultAdapter({ ai_enabled: true, traffic_authorized: true, authority, create_gateway_transport: createTransport }).request({
    fixture_id: fixture("ZH08").fixture_id,
    question: fixture("ZH08").exact_text,
  });
  check(rejected.kind === "validation" && rejected.code === "DICE_QUESTION_BUNDLED", "ZH08 remains bundled rejection");
  check(constructions === 0 && calls === 0, "validation stops before gateway construction");

  for (const fixture_id of [
    "dice-founder-en-00", "dice-founder-en-21", "dice-founder-en-99",
    "dice-founder-zh-00", "dice-founder-zh-21", "dice-founder-zh-99",
    "dice-founder-en-1", "DICE-FOUNDER-EN-01", "../dice-founder-en-01",
  ]) {
    const beforeConstructions: number = Number(constructions);
    const beforeCalls: number = Number(calls);
    const state = await createDiceLiveResultAdapter({ ai_enabled: true, traffic_authorized: true, authority, create_gateway_transport: createTransport }).request({
      fixture_id,
      question: fixture("EN01").exact_text,
    });
    check(state.kind === "validation" && state.code === "DICE_FIXTURE_ID_INVALID", `${fixture_id} must fail exact membership`);
    check(constructions === beforeConstructions && calls === beforeCalls, `${fixture_id} must stop before transport construction`);
  }

  const excludedZh04 = await createDiceLiveResultAdapter({ ai_enabled: true, traffic_authorized: true, authority, create_gateway_transport: createTransport }).request({
    fixture_id: "dice-founder-zh-04",
    question: "我去到澳洲應該讀書定係做嘢？",
  });
  check(excludedZh04.kind === "validation" && excludedZh04.code === "DICE_FIXTURE_ID_INVALID", "excluded ZH04 text cannot use a valid slot");
  check(constructions === 0 && calls === 0, "excluded ZH04 stops before transport construction");

  const states: DiceLiveResultState[] = [];
  const completed = await createDiceLiveResultAdapter({ ai_enabled: true, traffic_authorized: true, authority, create_gateway_transport: createTransport }).request({
    fixture_id: fixture("EN01").fixture_id,
    question: fixture("EN01").exact_text,
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
  }).request({ fixture_id: fixture("EN01").fixture_id, question: fixture("EN01").exact_text });
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
  }).request({ fixture_id: fixture("EN01").fixture_id, question: fixture("EN01").exact_text });
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
    }).request({ fixture_id: fixture("EN02").fixture_id, question: fixture("EN02").exact_text });
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
  }).request({ fixture_id: fixture("EN03").fixture_id, question: fixture("EN03").exact_text });
  check(retry.kind === "retry" && retry.code === "DICE_PROVIDER_TIMEOUT", "technical error projects retry without raw diagnostics");

  const zh09 = await createDiceLiveResultAdapter({ ai_enabled: false, traffic_authorized: false, authority: null }).request({
    fixture_id: fixture("ZH09").fixture_id,
    question: fixture("ZH09").exact_text,
  });
  check(zh09.kind === "disabled", "ZH09 remains an accepted single question and reaches the disabled live gate");

  console.log("S2-T302 Dice live-result adapter fixtures passed");
}

void main();
