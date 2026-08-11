import assert from "node:assert/strict";

import {
  NO_AZURE_TRAFFIC_AUTHORITY,
  NO_NORMAL_CHAT_INTEGRATION_AUTHORITY,
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  buildNormalChatCandidateRequest,
  invokeNormalChatAiCandidate,
  validateNormalChatCandidateResponse,
} from "./normalChatAiCandidate";

const clientTurnId = "123e4567-e89b-42d3-a456-426614174000";
const threadId = "89abcdef-0123-4567-89ab-0123456789ab";
let transportConstructions = 0;
let transportCalls = 0;

const request = buildNormalChatCandidateRequest({
  clientTurnId,
  message: "  A decomposed e\u0301 reflection?\r\n  ",
  threadIntent: { mode: "new" },
});
assert.equal(request.message, "A decomposed é reflection?");
assert.deepEqual(Object.keys(request).sort(), ["client_turn_id", "message", "schema_version", "thread_intent"]);
assert(!("provider" in request) && !("chart_context" in request) && !("account_id" in request));

async function main() {
await assert.rejects(
  invokeNormalChatAiCandidate(request, () => {
    transportConstructions += 1;
    return { async invoke() { transportCalls += 1; return {}; } };
  }),
  /NORMAL_CHAT_AI_CANDIDATE_DISABLED/,
);
assert.equal(transportConstructions, 0);
assert.equal(transportCalls, 0);

assert.throws(() => buildNormalChatCandidateRequest({
  clientTurnId,
  message: "hello",
  threadIntent: { mode: "continue", thread_id: "not-a-uuid" },
}), /NORMAL_CHAT_THREAD_INTENT_INVALID/);

const completed = validateNormalChatCandidateResponse({
  schema_version: "normal_chat_mobile_response_v1",
  request_id: "request_12345678",
  client_turn_id: clientTurnId,
  result: "completed",
  thread_id: threadId,
  assistant_message: "A bounded reflection.",
  persistence: "committed",
  idempotency_outcome: "committed",
  units_charged: 1,
  atomic_outcome: {
    user_message: "committed",
    assistant_message: "committed",
    unit_ledger: "committed",
    idempotency_outcome: "committed",
  },
});
assert.equal(completed.thread_id, threadId);

for (const response of [
  {
    result: "fixed_fallback",
    assistant_message: T240_FIXED_FALLBACK,
    error_code: "NORMAL_CHAT_PROVIDER_UNAVAILABLE",
  },
  {
    result: "safety_rejected",
    assistant_message: T240_SAFETY_REDIRECT,
    error_code: "NORMAL_CHAT_SAFETY_REDIRECT",
  },
  { result: "technical_error", error_code: "NORMAL_CHAT_CONFIGURATION_UNAVAILABLE" },
] as const) {
  validateNormalChatCandidateResponse({
    schema_version: "normal_chat_mobile_response_v1",
    request_id: "request_12345678",
    client_turn_id: clientTurnId,
    persistence: "not_committed",
    idempotency_outcome: "not_committed",
    units_charged: 0,
    ...response,
  });
}

assert.throws(() => validateNormalChatCandidateResponse({
  schema_version: "normal_chat_mobile_response_v1",
  request_id: "request_12345678",
  client_turn_id: clientTurnId,
  result: "technical_error",
  assistant_message: "leak",
  error_code: "NORMAL_CHAT_TECHNICAL_ERROR",
  persistence: "not_committed",
  idempotency_outcome: "not_committed",
  units_charged: 0,
}), /TECHNICAL_TEXT_FORBIDDEN/);

assert.equal(NO_NORMAL_CHAT_INTEGRATION_AUTHORITY, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(NO_AZURE_TRAFFIC_AUTHORITY, "NO_AZURE_TRAFFIC_AUTHORITY");
console.log("S2_T306_MOBILE_SEAM_FIXTURES_OK");
}

void main();
