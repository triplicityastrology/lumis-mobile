import {
  handleNormalChatAiCandidate,
  type NormalChatCandidateDependencies,
  type NormalChatMobileResponse,
} from "./normal-chat-ai-candidate-v1.ts";

export const CHAT_RELEASE_SERVER_VERSION = "s2_t311_normal_chat_release_candidate_v1" as const;
export const CHAT_RELEASE_SERVER_ENABLED = false as const;
export const CHAT_RELEASE_SERVER_TRAFFIC_ENABLED = false as const;
export const FINAL_DICE_EVIDENCE_SCHEMA = "s2_t296_accepted_dice_v4_technical_evidence_v1" as const;
export const CHAT_DEPLOYMENT_RECEIPT_SCHEMA = "s2_t311_chat_default_off_deployment_receipt_v1" as const;
export const CHAT_TRAFFIC_RECEIPT_SCHEMA = "s2_t311_chat_synthetic_traffic_authorization_v1" as const;

export type ChatReleaseFixtureId = "chat-en-reflection-01" | "chat-zh-hant-reflection-01";
export type ChatReleaseServerRequest = Readonly<{
  schema_version: "chat_release_candidate_mobile_v1";
  fixture_id: ChatReleaseFixtureId;
}>;

type ReleaseControls = Readonly<{
  acceptedDiceEvidenceSha256: string | null;
  acceptedDeploymentReceiptSha256: string | null;
  acceptedTrafficReceiptSha256: string | null;
}>;

export type ChatReleaseDependencies = Readonly<{
  controls: ReleaseControls;
  diceEvidence: unknown;
  deploymentReceipt: unknown;
  trafficReceipt: unknown;
  sha256Canonical(value: unknown): string;
  candidate: NormalChatCandidateDependencies;
  nextClientTurnId(): string;
}>;

const FIXTURES: Readonly<Record<ChatReleaseFixtureId, Readonly<{ message: string; language: "en" | "zh-Hant" }>>> = Object.freeze({
  "chat-en-reflection-01": Object.freeze({
    language: "en",
    message: "Help me reflect on a difficult choice without telling me what decision to make.",
  }),
  "chat-zh-hant-reflection-01": Object.freeze({
    language: "zh-Hant",
    message: "請幫我梳理一個困難嘅選擇，但唔好代我作決定。",
  }),
});

export async function handleChatReleaseCandidate(
  rawRequest: unknown,
  dependencies: ChatReleaseDependencies,
): Promise<NormalChatMobileResponse> {
  // Admission happens before request parsing, auth/database work, or provider construction.
  if (
    !CHAT_RELEASE_SERVER_ENABLED ||
    !CHAT_RELEASE_SERVER_TRAFFIC_ENABLED ||
    !validateEvidence(dependencies)
  ) {
    return disabledResponse();
  }

  /* c8 ignore start -- separately reviewed source activation is required */
  const request = parseRequest(rawRequest);
  const fixture = FIXTURES[request.fixture_id];
  return handleNormalChatAiCandidate({
    schema_version: "normal_chat_mobile_request_v1",
    client_turn_id: dependencies.nextClientTurnId(),
    message: fixture.message,
    thread_intent: { mode: "new" },
  }, dependencies.candidate);
  /* c8 ignore stop */
}

function validateEvidence(dependencies: ChatReleaseDependencies): boolean {
  const entries = [
    [dependencies.diceEvidence, dependencies.controls.acceptedDiceEvidenceSha256, FINAL_DICE_EVIDENCE_SCHEMA],
    [dependencies.deploymentReceipt, dependencies.controls.acceptedDeploymentReceiptSha256, CHAT_DEPLOYMENT_RECEIPT_SCHEMA],
    [dependencies.trafficReceipt, dependencies.controls.acceptedTrafficReceiptSha256, CHAT_TRAFFIC_RECEIPT_SCHEMA],
  ] as const;
  return entries.every(([value, acceptedSha, schema]) => {
    if (!isRecord(value) || value.schema !== schema || typeof acceptedSha !== "string" || !/^[a-f0-9]{64}$/.test(acceptedSha)) return false;
    return dependencies.sha256Canonical(value) === acceptedSha;
  });
}

function parseRequest(value: unknown): ChatReleaseServerRequest {
  if (!isRecord(value) || Object.keys(value).length !== 2 || value.schema_version !== "chat_release_candidate_mobile_v1") {
    throw new Error("CHAT_RELEASE_REQUEST_INVALID");
  }
  if (typeof value.fixture_id !== "string" || !(value.fixture_id in FIXTURES)) {
    throw new Error("CHAT_RELEASE_FIXTURE_ID_INVALID");
  }
  return value as ChatReleaseServerRequest;
}

function disabledResponse(): NormalChatMobileResponse {
  return Object.freeze({
    schema_version: "normal_chat_mobile_response_v1",
    request_id: "chat_disabled_request",
    client_turn_id: "00000000-0000-4000-8000-000000000000",
    result: "technical_error",
    error_code: "NORMAL_CHAT_AI_DISABLED",
    persistence: "not_committed",
    idempotency_outcome: "not_committed",
    units_charged: 0,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
