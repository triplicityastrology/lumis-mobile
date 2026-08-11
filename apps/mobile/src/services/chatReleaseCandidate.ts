import {
  invokeNormalChatAiCandidate,
  type NormalChatCandidateResponse,
} from "./normalChatAiCandidate";

export const CHAT_RELEASE_CANDIDATE_VERSION = "s2_t311_chat_release_candidate_v1" as const;
export const CHAT_RELEASE_CANDIDATE_ENABLED = false as const;
export const CHAT_RELEASE_TRAFFIC_ENABLED = false as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

export type ChatFounderFixtureId = "chat-en-reflection-01" | "chat-zh-hant-reflection-01";
export type ChatReleaseCandidateRequest = Readonly<{
  schema_version: "chat_release_candidate_mobile_v1";
  fixture_id: ChatFounderFixtureId;
}>;

export type ChatReleaseCandidateTransport = Readonly<{
  invoke(request: ChatReleaseCandidateRequest): Promise<unknown>;
}>;

const FIXTURE_IDS: readonly ChatFounderFixtureId[] = Object.freeze([
  "chat-en-reflection-01",
  "chat-zh-hant-reflection-01",
]);

export class ChatReleaseCandidateUnavailableError extends Error {
  readonly code = "CHAT_RELEASE_CANDIDATE_DISABLED";

  constructor() {
    super("CHAT_RELEASE_CANDIDATE_DISABLED");
    this.name = "ChatReleaseCandidateUnavailableError";
  }
}

export function buildChatReleaseCandidateRequest(value: unknown): ChatReleaseCandidateRequest {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !("fixture_id" in value)) {
    throw new Error("CHAT_RELEASE_CANDIDATE_CLOSED_REQUEST_REQUIRED");
  }
  if (typeof value.fixture_id !== "string" || !FIXTURE_IDS.includes(value.fixture_id as ChatFounderFixtureId)) {
    throw new Error("CHAT_RELEASE_CANDIDATE_FIXTURE_ID_INVALID");
  }
  return Object.freeze({
    schema_version: "chat_release_candidate_mobile_v1",
    fixture_id: value.fixture_id as ChatFounderFixtureId,
  });
}

export async function invokeChatReleaseCandidate(
  _request: ChatReleaseCandidateRequest,
  _transportFactory: () => ChatReleaseCandidateTransport,
): Promise<NormalChatCandidateResponse> {
  // A reviewed source change must activate both boundaries. Runtime input,
  // mobile configuration, or imported evidence can never activate this path.
  if (!CHAT_RELEASE_CANDIDATE_ENABLED || !CHAT_RELEASE_TRAFFIC_ENABLED) {
    throw new ChatReleaseCandidateUnavailableError();
  }
  /* c8 ignore next 4 -- unreachable without separate integration and traffic authority */
  const transport = _transportFactory();
  /* c8 ignore next */
  return invokeNormalChatAiCandidate(
    // The server owns fixture expansion. Mobile never sends prompt or member context.
    _request as never,
    () => ({ invoke: () => transport.invoke(_request) }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
