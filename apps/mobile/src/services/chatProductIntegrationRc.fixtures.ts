import {
  CHAT_PRODUCT_INTEGRATION_ENABLED,
  CHAT_PRODUCT_TRAFFIC_ENABLED,
  NO_AZURE_TRAFFIC_AUTHORITY,
  NO_NORMAL_CHAT_INTEGRATION_AUTHORITY,
  buildExplicitDiceReflectProductPayload,
  getChatProductLocalFixtureDispatchCountForTests,
  resetChatProductLocalFixtureForTests,
  sendChatProductIntegrationMessage,
} from "./chatProductIntegrationRc";
import { T240_FIXED_FALLBACK, T240_SAFETY_REDIRECT } from "./normalChatAiCandidate";

const baseMessage = {
  message: "How can I approach this decision more calmly?",
  clientMessageId: "123e4567-e89b-42d3-a456-426614174000",
  personaStyle: "acceptance",
  appLanguagePreference: "en",
  chart: null,
} as const;

check(CHAT_PRODUCT_INTEGRATION_ENABLED === false, "integration disabled");
check(CHAT_PRODUCT_TRAFFIC_ENABLED === false, "traffic disabled");
check(NO_NORMAL_CHAT_INTEGRATION_AUTHORITY === "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "normal Chat authority absent");
check(NO_AZURE_TRAFFIC_AUTHORITY === "NO_AZURE_TRAFFIC_AUTHORITY", "Azure authority absent");

async function main() {
  let transportConstructions = 0;
  await rejects(sendChatProductIntegrationMessage({
    message: baseMessage,
    mode: { development_local_fixture: false, fixture_state: "completed" },
    create_transport: () => {
      transportConstructions += 1;
      return { invoke: async () => ({}) };
    },
  }), "CHAT_PRODUCT_INTEGRATION_DISABLED");
  check(transportConstructions === 0, "disabled before transport construction");

  resetChatProductLocalFixtureForTests();
  const first = sendChatProductIntegrationMessage({
    message: baseMessage,
    mode: { development_local_fixture: true, fixture_state: "completed" },
  });
  const duplicate = sendChatProductIntegrationMessage({
    message: baseMessage,
    mode: { development_local_fixture: true, fixture_state: "completed" },
  });
  const [completed, replayed] = await Promise.all([first, duplicate]);
  check(completed === replayed, "same client turn converges on one local fixture result");
  check(getChatProductLocalFixtureDispatchCountForTests() === 1, "one local fixture dispatch");
  check(completed.creditsCost === 0, "completed fixture charges zero");
  check(completed.persistenceMode === "not_persisted", "completed fixture is not persisted");

  for (const [state, expected] of [
    ["fallback", T240_FIXED_FALLBACK],
    ["safety", T240_SAFETY_REDIRECT],
  ] as const) {
    resetChatProductLocalFixtureForTests();
    const result = await sendChatProductIntegrationMessage({
      message: { ...baseMessage, clientMessageId: `${baseMessage.clientMessageId}-${state}` },
      mode: { development_local_fixture: true, fixture_state: state },
    });
    check(result.reply === expected, `${state} copy`);
    check(result.creditsCost === 0, `${state} charges zero`);
    check(result.persistenceMode === "not_persisted", `${state} not persisted`);
  }

  resetChatProductLocalFixtureForTests();
  const zh = await sendChatProductIntegrationMessage({
    message: {
      ...baseMessage,
      clientMessageId: "123e4567-e89b-42d3-a456-426614174001",
      message: "我可以點樣冷靜咁面對呢個決定？",
      appLanguagePreference: "zh-Hant",
    },
    mode: { development_local_fixture: true, fixture_state: "completed" },
  });
  check(/[\u3400-\u9fff]/u.test(zh.reply), "zh-Hant response");
  check(zh.creditsCost === 0, "zh-Hant charges zero");

  resetChatProductLocalFixtureForTests();
  await rejects(sendChatProductIntegrationMessage({
    message: { ...baseMessage, clientMessageId: "123e4567-e89b-42d3-a456-426614174002" },
    mode: { development_local_fixture: true, fixture_state: "technical_error" },
  }), "CHAT_PRODUCT_LOCAL_TECHNICAL_ERROR");

  const handoff = buildExplicitDiceReflectProductPayload(
    "Help me reflect on my astrology dice throw. My question was: “What matters now?” The dice showed Venus, Leo, 6th House. The Dice interpretation was: Let the practical next step reveal the answer.",
  );
  check(handoff.action === "reflect_in_chat", "explicit action");
  check(JSON.stringify(handoff.results) === JSON.stringify(["Venus", "Leo", "6th House"]), "three Dice results");
  check(handoff.chat_draft.includes("The Dice interpretation was"), "interpretation retained");
  const resultOnlyHandoff = buildExplicitDiceReflectProductPayload(
    "Help me reflect on my astrology dice throw. My question was: “What matters now?” The dice showed Venus, Leo, 6th House.",
  );
  check(resultOnlyHandoff.interpretation === null, "result-only Dice handoff remains explicit");
  throws(() => buildExplicitDiceReflectProductPayload("Open Chat automatically"), "EXPLICIT_ACTION_REQUIRED");

  console.log("S2_T341_CHAT_PRODUCT_INTEGRATION_FIXTURES_OK");
}

void main();

function check(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(`S2_T341_FIXTURE_FAILED:${label}`);
}

async function rejects(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    check(error instanceof Error && error.message.includes(code), `expected rejection ${code}`);
    return;
  }
  throw new Error(`S2_T341_FIXTURE_FAILED:missing rejection ${code}`);
}

function throws(callback: () => unknown, code: string): void {
  try {
    callback();
  } catch (error) {
    check(error instanceof Error && error.message.includes(code), `expected throw ${code}`);
    return;
  }
  throw new Error(`S2_T341_FIXTURE_FAILED:missing throw ${code}`);
}
