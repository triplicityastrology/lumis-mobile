import {
  handleChatPostDiceReleaseCandidate,
  type ChatPostDiceDependencies,
} from "./chat-post-dice-release-candidate-v1.ts";

export const CHAT_PRODUCT_PATH_SERVER_VERSION = "s2_t326_chat_product_path_server_v1" as const;
export const CHAT_PRODUCT_PATH_SERVER_ENABLED = false as const;
export const CHAT_PRODUCT_PATH_SERVER_TRAFFIC_ENABLED = false as const;

export async function handleChatProductPathCandidate(
  rawRequest: unknown,
  dependencies: ChatPostDiceDependencies,
) {
  // Source switches precede request parsing, evidence reads, actor resolution,
  // database work, provider construction, and telemetry mutation.
  if (!CHAT_PRODUCT_PATH_SERVER_ENABLED || !CHAT_PRODUCT_PATH_SERVER_TRAFFIC_ENABLED) {
    return disabledResponse();
  }
  /* c8 ignore next -- requires later reviewed activation plus exact receipts */
  return handleChatPostDiceReleaseCandidate(rawRequest, dependencies);
}

function disabledResponse() {
  return Object.freeze({
    schema_version: "normal_chat_mobile_response_v1",
    request_id: "chat_t326_disabled",
    client_turn_id: "00000000-0000-4000-8000-000000000000",
    result: "technical_error",
    error_code: "NORMAL_CHAT_AI_DISABLED",
    persistence: "not_committed",
    idempotency_outcome: "not_committed",
    units_charged: 0,
  });
}
