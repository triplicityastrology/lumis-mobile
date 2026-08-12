import {
  assertZeroEffectNonSuccess,
  startChatProductPath,
} from "./chatProductPathCandidate";
import {
  buildExplicitDiceReflectHandoff,
  type DiceReflectHandoff,
} from "./chatPostDiceReleaseCandidate";
import {
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  validateNormalChatCandidateResponse,
  type NormalChatCandidateResponse,
} from "./normalChatAiCandidate";

export const CHAT_AFTER_DICE_ROOT_VERSION = "s2_t331_chat_after_dice_root_v1" as const;
export const CHAT_AFTER_DICE_DEPLOYMENT_ENABLED = false as const;
export const CHAT_AFTER_DICE_SYNTHETIC_TRAFFIC_ENABLED = false as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

export const T317_FINAL_RELEASE_SOURCE = Object.freeze({
  status: "source_complete_awaiting_independent_review",
  commit: "8706db6cadbbf4ae0a58d10a194479a0c7aca465",
  tree: "edf01652aa245cc1bc202f3e3cee677b074a2565",
  control_sha256: "323fb6e46b9a7ddf36bd360ab4c38bd2e87591ef5bd896a3e4e4035d944508c4",
  seal_sha256: "755704f334f4ab38565696a273055ca12469b4660801a736fa0f87091bb5e18e",
  package_sha256: "749c0c0910cdde915d7ab008ecb92b0471cefc795935e47b1e1a2b74451e0c69",
} as const);

export const T322_PRE_ROLL_SOURCE = Object.freeze({
  status: "source_complete_awaiting_reseal_and_independent_review",
  commit: "cd67316df0b9788886945527f9a51443591e432a",
  tree: "4759dd413023afe507b14cccc109256d4befa5f2",
  control_sha256: "94a340875b8d155f4ac8955dacc3563e30d9bf6a38cabe145616802446b226b6",
  seal_sha256: "c93163c784450cde43db4b6ce13da1ea6675cfd69792761ba199473717723640",
  package_sha256: "7675005910e519cdaba9035e33285cf1bd4390ba5b2702d20c241089f3991735",
} as const);

export type ChatAfterDiceLanguage = "en" | "zh-Hant";
export type DisabledChatPhase = "loading" | "result" | "safety" | "fallback" | "retry";

export type DisabledChatProjection = Readonly<{
  language: ChatAfterDiceLanguage;
  phase: DisabledChatPhase;
  assistant_message: string;
  live: false;
  provider_calls: 0;
  persistence_writes: 0;
  units_charged: 0;
}>;

export type CorrectedDiceEvidenceBinding = Readonly<{
  accepted_evidence_sha256: string | null;
  t317_independent_review_sha256: string | null;
  t322_reseal_and_review_sha256: string | null;
}>;

export type ChatAfterDiceControls = Readonly<{
  corrected_dice: CorrectedDiceEvidenceBinding;
  default_off_deployment_receipt_sha256: string | null;
  synthetic_traffic_receipt_sha256: string | null;
}>;

export class ChatAfterDiceUnavailableError extends Error {
  readonly code = "CHAT_AFTER_DICE_DISABLED";
  constructor() {
    super("CHAT_AFTER_DICE_DISABLED");
    this.name = "ChatAfterDiceUnavailableError";
  }
}

export function projectDisabledChatState(
  language: ChatAfterDiceLanguage,
  phase: DisabledChatPhase,
): DisabledChatProjection {
  const localized = {
    en: {
      loading: "Reflecting...",
      result: "Offline preview: notice what became clearer, then choose one reversible next step.",
      retry: "The offline preview is ready to retry.",
    },
    "zh-Hant": {
      loading: "整理思緒中...",
      result: "離線預覽：留意剛才清晰咗嘅部分，再揀一個可以回頭嘅下一步。",
      retry: "離線預覽已準備好，可以重試。",
    },
  } as const;
  const assistant_message = phase === "safety"
    ? T240_SAFETY_REDIRECT
    : phase === "fallback"
      ? T240_FIXED_FALLBACK
      : localized[language][phase];
  return Object.freeze({
    language,
    phase,
    assistant_message,
    live: false,
    provider_calls: 0,
    persistence_writes: 0,
    units_charged: 0,
  });
}

export function buildExplicitChatAfterDiceHandoff(value: unknown): DiceReflectHandoff {
  return buildExplicitDiceReflectHandoff(value);
}

export function validateCorrectedDiceEvidence(
  value: unknown,
  binding: CorrectedDiceEvidenceBinding,
): boolean {
  if (
    !isSha256(binding.accepted_evidence_sha256) ||
    !isSha256(binding.t317_independent_review_sha256) ||
    !isSha256(binding.t322_reseal_and_review_sha256) ||
    !isRecord(value)
  ) return false;
  const keys = [
    "schema", "decision", "t317_source", "t322_source",
    "t317_independent_review_sha256", "t322_reseal_and_review_sha256",
    "normal_chat_unchanged", "reflect_handoff", "post_validation_disabled",
  ];
  if (!exactKeys(value, keys)) return false;
  return value.schema === "s2_t331_corrected_dice_evidence_acceptance_v1" &&
    value.decision === "accepted" &&
    exactSource(value.t317_source, T317_FINAL_RELEASE_SOURCE) &&
    exactSource(value.t322_source, T322_PRE_ROLL_SOURCE) &&
    value.t317_independent_review_sha256 === binding.t317_independent_review_sha256 &&
    value.t322_reseal_and_review_sha256 === binding.t322_reseal_and_review_sha256 &&
    value.normal_chat_unchanged === true &&
    value.reflect_handoff === "explicit_reflect_in_chat" &&
    value.post_validation_disabled === true;
}

export async function invokeChatAfterDiceRoot(input: Readonly<{
  language: ChatAfterDiceLanguage;
  controls: ChatAfterDiceControls;
  corrected_dice_evidence: unknown;
  handoff: unknown;
  create_transport: () => Readonly<{ invoke(): Promise<unknown> }>;
}>): Promise<NormalChatCandidateResponse> {
  // Fixed source gates precede evidence, handoff, request, transport, auth,
  // persistence, billing, provider, and telemetry work.
  if (!CHAT_AFTER_DICE_DEPLOYMENT_ENABLED || !CHAT_AFTER_DICE_SYNTHETIC_TRAFFIC_ENABLED) {
    throw new ChatAfterDiceUnavailableError();
  }
  /* c8 ignore start -- later reviewed source activation is required */
  if (
    !validateCorrectedDiceEvidence(input.corrected_dice_evidence, input.controls.corrected_dice) ||
    !isSha256(input.controls.default_off_deployment_receipt_sha256) ||
    !isSha256(input.controls.synthetic_traffic_receipt_sha256)
  ) throw new ChatAfterDiceUnavailableError();
  buildExplicitChatAfterDiceHandoff(input.handoff);
  const fixtureId = input.language === "en" ? "chat-en-reflection-01" : "chat-zh-hant-reflection-01";
  startChatProductPath(fixtureId);
  const response = validateNormalChatCandidateResponse(await input.create_transport().invoke());
  assertZeroEffectNonSuccess(response);
  return response;
  /* c8 ignore stop */
}

function exactSource(value: unknown, expected: Readonly<Record<string, string>>): boolean {
  return isRecord(value) && exactKeys(value, Object.keys(expected)) &&
    Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
