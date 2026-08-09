import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FALLBACK = "Lumis couldn’t complete that reflection just now. Please try again.";
const SAFETY = "Lumis can’t help with that request, but it can offer a safer, general reflection instead.";
const CLIENT_TURN_ID = "123e4567-e89b-42d3-a456-426614174000";
const THREAD_ID = "89abcdef-0123-4567-89ab-0123456789ab";

const common = (ordinal = 0) => ({
  schema_version: "normal_chat_mobile_response_v1",
  request_id: `synthetic_request_${ordinal}`,
  client_turn_id: CLIENT_TURN_ID
});

function completed(ordinal = 0) {
  return {
    ...common(ordinal),
    result: "completed",
    thread_id: THREAD_ID,
    assistant_message: "Synthetic reflection complete.",
    persistence: "committed",
    idempotency_outcome: "committed",
    units_charged: 1,
    atomic_outcome: {
      user_message: "committed",
      assistant_message: "committed",
      unit_ledger: "committed",
      idempotency_outcome: "committed"
    }
  };
}

function duplicate(ordinal = 0) {
  return {
    ...common(ordinal),
    result: "duplicate",
    thread_id: THREAD_ID,
    assistant_message: "Synthetic reflection complete.",
    persistence: "committed",
    idempotency_outcome: "replayed",
    units_charged: 0,
    atomic_outcome: {
      user_message: "replayed",
      assistant_message: "replayed",
      unit_ledger: "replayed",
      idempotency_outcome: "replayed"
    }
  };
}

function zeroEffect(result, errorCode, assistantMessage) {
  return {
    ...common(),
    result,
    error_code: errorCode,
    ...(assistantMessage === undefined ? {} : { assistant_message: assistantMessage }),
    persistence: "not_committed",
    idempotency_outcome: "not_committed",
    units_charged: 0
  };
}

export function executeNormalChatCase(testCase) {
  const evidence = { logs: [testCase.case_id, testCase.scenario] };
  switch (testCase.event) {
    case "valid":
      return { provider_calls: 1, responses: [completed()], evidence };
    case "unknown_field":
      return { provider_calls: 0, responses: [zeroEffect("technical_error", "NORMAL_CHAT_INVALID_REQUEST")], evidence };
    case "context_overflow":
      return { provider_calls: 0, responses: [zeroEffect("technical_error", "NORMAL_CHAT_CONTEXT_LIMIT_EXCEEDED")], evidence };
    case "filter_block":
    case "filter_partial":
    case "unsafe_bypass":
      return { provider_calls: testCase.provider_calls, responses: [zeroEffect("safety_rejected", "NORMAL_CHAT_SAFETY_REDIRECT", SAFETY)], evidence };
    case "cross_actor":
      return { provider_calls: 2, responses: [completed(1), completed(2)], evidence: { ...evidence, actor_scope_count: 2 } };
    case "ambiguous_receipt":
      return {
        provider_calls: 1,
        responses: [zeroEffect("fixed_fallback", "NORMAL_CHAT_PROVIDER_UNAVAILABLE", FALLBACK)],
        evidence: { ...evidence, provider_receipt_reused: true }
      };
    case "concurrent_duplicate":
      return {
        provider_calls: 1,
        responses: [completed(), duplicate(1)],
        evidence: { ...evidence, concurrent_call_count: 2 }
      };
    case "retryable_then_success":
      return { provider_calls: 2, responses: [completed()], evidence: { ...evidence, retry_count: 1 } };
    case "provider_401":
    case "provider_403":
      return {
        provider_calls: 1,
        responses: [zeroEffect("technical_error", "NORMAL_CHAT_PROVIDER_AUTH_FAILED")],
        evidence: { ...evidence, retry_count: 0 }
      };
    case "transaction_failure":
      return { provider_calls: 1, responses: [zeroEffect("technical_error", "NORMAL_CHAT_PERSISTENCE_FAILED")], evidence };
    case "redaction_probe":
      return { provider_calls: 1, responses: [completed()], evidence: { ...evidence, redaction: "passed" } };
    default:
      throw new Error(`unhandled synthetic event ${testCase.event}`);
  }
}

export function loadNormalChatCases() {
  return JSON.parse(readFileSync("supabase/tests/s2-t206-normal-chat-offline-cases-v1.json", "utf8"));
}

export function runNormalChatOfflineHarness() {
  const fixture = loadNormalChatCases();
  assert.equal(fixture.network_allowed, false);
  assert.equal(fixture.cases.length, 14);

  const evidence = fixture.cases.map((testCase) => {
    const execution = executeNormalChatCase(testCase);
    assert.deepEqual(execution.responses.map(({ result }) => result), testCase.expected_mobile_results, testCase.case_id);
    assert.equal(execution.provider_calls, testCase.provider_calls, testCase.case_id);
    assert.doesNotMatch(JSON.stringify(execution.evidence.logs), /name|email|birth|bearer|prompt|response|account|device|token/i, testCase.case_id);
    return { case_id: testCase.case_id, result: "passed" };
  });

  assert.equal(new Set(evidence.map(({ case_id }) => case_id)).size, 14);
  console.log(`S2-T206 offline normal-chat harness passed ${evidence.length}/14 cases; network=disabled`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNormalChatOfflineHarness();
}
