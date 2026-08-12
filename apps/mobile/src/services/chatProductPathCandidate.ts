import {
  buildChatReleaseCandidateRequest,
  type ChatFounderFixtureId,
  type ChatReleaseCandidateTransport,
} from "./chatReleaseCandidate";
import {
  invokeChatPostDiceReleaseCandidate,
  type T317DiceEvidenceBinding,
} from "./chatPostDiceReleaseCandidate";
import {
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  validateNormalChatCandidateResponse,
  type NormalChatCandidateResponse,
} from "./normalChatAiCandidate";

export const CHAT_PRODUCT_PATH_VERSION = "s2_t326_chat_product_path_v1" as const;
export const CHAT_PRODUCT_PATH_INTEGRATION_ENABLED = false as const;
export const CHAT_PRODUCT_PATH_TRAFFIC_ENABLED = false as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

export type ChatProductPathState =
  | Readonly<{ phase: "loading"; fixture_id: ChatFounderFixtureId }>
  | Readonly<{ phase: "response"; fixture_id: ChatFounderFixtureId; response: NormalChatCandidateResponse }>
  | Readonly<{ phase: "retry"; fixture_id: ChatFounderFixtureId; message: typeof T240_FIXED_FALLBACK }>;

export type ChatProductPathControls = Readonly<{
  accepted_dice_evidence_sha256: string | null;
  accepted_deployment_receipt_sha256: string | null;
  accepted_traffic_receipt_sha256: string | null;
}>;

export class ChatProductPathUnavailableError extends Error {
  readonly code = "CHAT_PRODUCT_PATH_DISABLED";
  constructor() {
    super("CHAT_PRODUCT_PATH_DISABLED");
    this.name = "ChatProductPathUnavailableError";
  }
}

export function startChatProductPath(fixture_id: ChatFounderFixtureId): ChatProductPathState {
  buildChatReleaseCandidateRequest({ fixture_id });
  return Object.freeze({ phase: "loading", fixture_id });
}

export async function invokeChatProductPath(input: Readonly<{
  fixture_id: ChatFounderFixtureId;
  controls: ChatProductPathControls;
  dice_evidence: unknown;
  dice_binding: T317DiceEvidenceBinding;
  create_transport: () => ChatReleaseCandidateTransport;
}>): Promise<ChatProductPathState> {
  buildChatReleaseCandidateRequest({ fixture_id: input.fixture_id });
  if (
    !CHAT_PRODUCT_PATH_INTEGRATION_ENABLED ||
    !CHAT_PRODUCT_PATH_TRAFFIC_ENABLED ||
    !isSha256(input.controls.accepted_dice_evidence_sha256) ||
    !isSha256(input.controls.accepted_deployment_receipt_sha256) ||
    !isSha256(input.controls.accepted_traffic_receipt_sha256)
  ) throw new ChatProductPathUnavailableError();

  /* c8 ignore next 6 -- separate source activation and three receipts are required */
  const response = validateNormalChatCandidateResponse(await invokeChatPostDiceReleaseCandidate({
    fixture_id: input.fixture_id,
    dice_evidence: input.dice_evidence,
    binding: input.dice_binding,
    create_transport: input.create_transport,
  }));
  /* c8 ignore next */
  return response.result === "fixed_fallback"
    ? Object.freeze({ phase: "retry", fixture_id: input.fixture_id, message: T240_FIXED_FALLBACK })
    : Object.freeze({ phase: "response", fixture_id: input.fixture_id, response });
}

export function assertZeroEffectNonSuccess(response: NormalChatCandidateResponse): void {
  if (response.result === "completed" || response.result === "duplicate") return;
  if (
    response.persistence !== "not_committed" ||
    response.idempotency_outcome !== "not_committed" ||
    response.units_charged !== 0 ||
    "thread_id" in response ||
    "atomic_outcome" in response
  ) throw new Error("CHAT_PRODUCT_PATH_NON_SUCCESS_EFFECT_INVALID");
  if (response.result === "fixed_fallback" && response.assistant_message !== T240_FIXED_FALLBACK) {
    throw new Error("CHAT_PRODUCT_PATH_FALLBACK_COPY_INVALID");
  }
  if (response.result === "safety_rejected" && response.assistant_message !== T240_SAFETY_REDIRECT) {
    throw new Error("CHAT_PRODUCT_PATH_SAFETY_COPY_INVALID");
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
