// @ts-expect-error The fixture runs in Node; this repo does not pin @types/node.
import assert from "node:assert/strict";

import {
  FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED,
  FOUNDER_LIVE_CHAT_TRAFFIC_ENABLED,
  buildFounderLiveChatRequest,
  invokeFounderLiveChat,
  listFounderLiveChatPrompts,
  sendFounderLiveChatProductMessage,
  validateFounderLiveChatResponse,
} from "./founderLiveChat";
import { T240_FIXED_FALLBACK, T240_SAFETY_REDIRECT } from "./normalChatAiCandidate";

const prompts = listFounderLiveChatPrompts();
assert.equal(prompts.length, 12);
assert.equal(prompts.filter(({ language }) => language === "en").length, 6);
assert.equal(prompts.filter(({ language }) => language === "zh-Hant").length, 6);
assert.equal(FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED, false);
assert.equal(FOUNDER_LIVE_CHAT_TRAFFIC_ENABLED, false);

const clientTurnId = "123e4567-e89b-42d3-a456-426614174000";
for (const prompt of prompts) {
  const request = buildFounderLiveChatRequest({ message: prompt.prompt, language: prompt.language, clientTurnId }, "chat-syn-authority0001");
  assert.equal(request.fixture_id, prompt.fixture_id);
  assert.equal(request.run_id, "chat-syn-authority0001");
  assert.deepEqual(Object.keys(request).sort(), ["fixture_id", "idempotency_key", "run_id"]);
}
assert.throws(() => buildFounderLiveChatRequest({ message: "Unlisted prompt", language: "en", clientTurnId }, "chat-syn-authority0001"), /FIXTURE_NOT_ALLOWED/);
assert.throws(() => buildFounderLiveChatRequest({ message: prompts[0].prompt, language: "en", clientTurnId }, "chat-founder-client0001"), /RUN_ID_INVALID/);

const base = {
  schema_version: "chat_synthetic_response_v1",
  fixture_id: prompts[0].fixture_id,
  language: "en",
  units_charged: 0,
  persistence: "not_committed",
  provider_attempts: 1,
} as const;
validateFounderLiveChatResponse({ ...base, result: "completed", assistant_message: "Notice one useful next step.", idempotency_outcome: "completed" }, prompts[0].fixture_id);
validateFounderLiveChatResponse({ ...base, result: "fixed_fallback", assistant_message: T240_FIXED_FALLBACK, idempotency_outcome: "not_committed", error_code: "CHAT_SYNTHETIC_PROVIDER_UNAVAILABLE" }, prompts[0].fixture_id);
validateFounderLiveChatResponse({ ...base, result: "safety_rejected", assistant_message: T240_SAFETY_REDIRECT, idempotency_outcome: "not_committed", error_code: "CHAT_SYNTHETIC_SAFETY_REDIRECT" }, prompts[0].fixture_id);
validateFounderLiveChatResponse({ ...base, result: "technical_error", idempotency_outcome: "not_committed", error_code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" }, prompts[0].fixture_id);
assert.throws(() => validateFounderLiveChatResponse({ ...base, result: "technical_error", assistant_message: "unsafe echo", idempotency_outcome: "not_committed", error_code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" }, prompts[0].fixture_id), /TECHNICAL_TEXT_FORBIDDEN/);

async function main() {
  let transports = 0;
  await assert.rejects(invokeFounderLiveChat({
    message: prompts[0].prompt,
    language: "en",
    clientTurnId,
    createTransport: () => { transports += 1; return { invoke: async () => ({}) }; },
  }), /FOUNDER_CHAT_LIVE_DISABLED/);
  assert.equal(transports, 0);
  await assert.rejects(sendFounderLiveChatProductMessage({
    message: {
      message: prompts[0].prompt,
      clientMessageId: clientTurnId,
      personaStyle: "acceptance",
      chart: null,
      appLanguagePreference: "en",
    },
    createTransport: () => { transports += 1; return { invoke: async () => ({}) }; },
  }), /FOUNDER_CHAT_LIVE_DISABLED/);
  assert.equal(transports, 0);
  console.log("FOUNDER_LIVE_CHAT_MOBILE_OK");
}

void main();
