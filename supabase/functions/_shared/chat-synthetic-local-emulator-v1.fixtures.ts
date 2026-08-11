import { strict as assert } from "node:assert";
import { runLocalChatEmulator, type LocalEmulatorInput } from "./chat-synthetic-local-emulator-v1.ts";
import { CHAT_SYNTHETIC_API_ROUTE_FAMILY, CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES } from "./chat-synthetic-integrated-authorization-v1.ts";

const matrix: readonly LocalEmulatorInput[] = [
  { fixture_id: "chat_en_small_decision_v1", idempotency_key: "local-en-companion-001", run_id: "chat-syn-local00000001", surface: "companion", scenario: "completed" },
  { fixture_id: "chat_zh_hant_small_decision_v1", idempotency_key: "local-zh-companion-001", run_id: "chat-syn-local00000002", surface: "companion", scenario: "completed" },
  { fixture_id: "chat_en_quiet_progress_v1", idempotency_key: "local-en-ordinary-001", run_id: "chat-syn-local00000003", surface: "ordinary_chat_projection", scenario: "completed" },
  { fixture_id: "chat_zh_hant_quiet_progress_v1", idempotency_key: "local-zh-ordinary-001", run_id: "chat-syn-local00000004", surface: "ordinary_chat_projection", scenario: "completed" },
  { fixture_id: "chat_en_unsafe_harm_v1", idempotency_key: "local-en-safety-00001", run_id: "chat-syn-local00000005", surface: "ordinary_chat_projection", scenario: "safety" },
  { fixture_id: "chat_zh_hant_unsafe_harm_v1", idempotency_key: "local-zh-safety-00001", run_id: "chat-syn-local00000006", surface: "companion", scenario: "safety" },
  { fixture_id: "chat_en_boundary_v1", idempotency_key: "local-filter-block-001", run_id: "chat-syn-local00000007", surface: "ordinary_chat_projection", scenario: "filter_block" },
  { fixture_id: "chat_zh_hant_boundary_v1", idempotency_key: "local-filter-partial-1", run_id: "chat-syn-local00000008", surface: "companion", scenario: "filter_partial" },
  { fixture_id: "chat_en_waiting_v1", idempotency_key: "local-malformed-000001", run_id: "chat-syn-local00000009", surface: "ordinary_chat_projection", scenario: "malformed" },
  { fixture_id: "chat_zh_hant_waiting_v1", idempotency_key: "local-retry-success-01", run_id: "chat-syn-local00000010", surface: "companion", scenario: "retry_then_success" },
  { fixture_id: "chat_en_overthinking_v1", idempotency_key: "local-timeout-0000001", run_id: "chat-syn-local00000011", surface: "ordinary_chat_projection", scenario: "timeout" },
  { fixture_id: "chat_zh_hant_overthinking_v1", idempotency_key: "local-idempotent-0001", run_id: "chat-syn-local00000012", surface: "ordinary_chat_projection", scenario: "idempotent_replay" },
  { fixture_id: "chat_en_mixed_feelings_v1", idempotency_key: "local-concurrent-0001", run_id: "chat-syn-local00000013", surface: "companion", scenario: "concurrent_duplicate" }
];

async function main() {
  const outcomes = [];
  for (const testCase of matrix) {
    const result = await runLocalChatEmulator(testCase);
    assert.equal(result.network_allowed, false);
    assert.equal(result.projection_only, true);
    assert.deepEqual(result.effects, { persistence_writes: 0, units_charged: 0, raw_logs: 0 });
    assert.deepEqual(result.microsoft_deployment_names, CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES);
    assert.equal(result.api_route_family, CHAT_SYNTHETIC_API_ROUTE_FAMILY);
    assert.equal(result.language, testCase.fixture_id.startsWith("chat_en_") ? "en" : "zh-Hant");
    assert.equal(JSON.stringify(result).includes("provider_secret"), false);
    outcomes.push(result);
  }

  assert.equal(outcomes.filter(({ language }) => language === "en").length, 7);
  assert.equal(outcomes.filter(({ language }) => language === "zh-Hant").length, 6);
  assert.deepEqual(outcomes[4].responses.map(({ result }) => result), ["safety_rejected"]);
  assert.deepEqual(outcomes[6].responses.map(({ result }) => result), ["safety_rejected"]);
  assert.deepEqual(outcomes[7].responses.map(({ result }) => result), ["safety_rejected"]);
  assert.deepEqual(outcomes[8].responses.map(({ result }) => result), ["technical_error"]);
  assert.equal(outcomes[9].provider_calls, 2);
  assert.deepEqual(outcomes[9].responses.map(({ result }) => result), ["completed"]);
  assert.deepEqual(outcomes[10].responses.map(({ result }) => result), ["fixed_fallback"]);
  assert.deepEqual(outcomes[11].responses.map(({ result }) => result), ["completed", "duplicate"]);
  assert.deepEqual(outcomes[12].responses.map(({ result }) => result).sort(), ["completed", "duplicate"]);
  assert.equal(outcomes[12].provider_calls, 1);

  await assert.rejects(
    () => runLocalChatEmulator({ ...matrix[0], message: "free form is closed" }),
    /CHAT_LOCAL_EMULATOR_INVALID_INPUT/
  );
  await assert.rejects(
    () => runLocalChatEmulator({ ...matrix[0], fixture_id: "chat_en_unknown_v1" }),
    /CHAT_LOCAL_EMULATOR_INVALID_INPUT/
  );
  console.log(`S2-T265 offline local emulator passed ${matrix.length} Companion/ordinary Chat cases; network=disabled`);
}

main();
