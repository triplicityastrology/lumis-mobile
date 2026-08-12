import {
  buildChatReleaseCandidateRequest,
  invokeChatReleaseCandidate,
  type ChatReleaseCandidateTransport,
} from "./chatReleaseCandidate";

export const CHAT_POST_DICE_RELEASE_VERSION = "s2_t321_chat_post_dice_release_v1" as const;
export const CHAT_POST_DICE_INTEGRATION_ENABLED = false as const;
export const CHAT_POST_DICE_TRAFFIC_ENABLED = false as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;
export const T317_FINAL_SOURCE_COMMIT = "8706db6cadbbf4ae0a58d10a194479a0c7aca465" as const;
export const T317_FINAL_SOURCE_TREE = "edf01652aa245cc1bc202f3e3cee677b074a2565" as const;
export const T317_FINAL_PACKAGE_SHA256 = "690879d6df3ecfd33a0a62ee0833f3bc278cfa11a2ab4062b8eba9eb659c1075" as const;
export const T317_FINAL_MANIFEST_SHA256 = "1ef44fd42677e98fc3edd49e2e7ba6abf1257dbbfe9cdf597b68c0ae9239ef84" as const;

export type T317DiceEvidenceBinding = Readonly<{
  source_commit: string | null;
  source_tree: string | null;
  release_package_sha256: string | null;
  release_manifest_sha256: string | null;
  evidence_sha256: string | null;
}>;

export type DiceReflectHandoff = Readonly<{
  target: "chat";
  chat_draft: string;
  provenance: "explicit_reflect_in_chat";
}>;

export class ChatPostDiceReleaseUnavailableError extends Error {
  readonly code = "CHAT_POST_DICE_RELEASE_DISABLED";

  constructor() {
    super("CHAT_POST_DICE_RELEASE_DISABLED");
    this.name = "ChatPostDiceReleaseUnavailableError";
  }
}

/**
 * The Dice result card owns this call. Merely receiving an interpretation never
 * navigates to Chat; only its existing Reflect in Chat press supplies this draft.
 */
export function buildExplicitDiceReflectHandoff(value: unknown): DiceReflectHandoff {
  if (!isRecord(value) || value.action !== "reflect_in_chat" || typeof value.chat_draft !== "string") {
    throw new Error("DICE_REFLECT_HANDOFF_EXPLICIT_ACTION_REQUIRED");
  }
  if (!exactKeys(value, ["action", "chat_draft"])) {
    throw new Error("DICE_REFLECT_HANDOFF_CLOSED_INPUT_REQUIRED");
  }
  const draft = value.chat_draft.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (
    !draft.startsWith("Help me reflect on my astrology dice throw. My question was: “") ||
    !draft.includes("The dice showed ") ||
    [...draft].length > 2_400
  ) {
    throw new Error("DICE_REFLECT_HANDOFF_INVALID");
  }
  return Object.freeze({ target: "chat", chat_draft: draft, provenance: "explicit_reflect_in_chat" });
}

export function validateAcceptedT317DiceEvidence(value: unknown, binding: T317DiceEvidenceBinding): boolean {
  if (
    !isSha40(binding.source_commit) ||
    !isSha40(binding.source_tree) ||
    !isSha256(binding.release_package_sha256) ||
    !isSha256(binding.release_manifest_sha256) ||
    !isSha256(binding.evidence_sha256) ||
    !isRecord(value)
  ) return false;

  const expectedKeys = [
    "schema", "decision", "source_commit", "source_tree", "release_package_sha256",
    "release_manifest_sha256", "registry_sha256",
    "technical_case_count", "language_counts", "post_window_disabled", "provider_enabled_after",
    "raw_content_retained", "member_data_used", "persistence_writes", "units_charged",
  ];
  if (!exactKeys(value, expectedKeys)) return false;
  if (
    value.schema !== "s2_t317_dice_technical_80_accepted_evidence_v1" ||
    value.decision !== "accepted" ||
    value.source_commit !== binding.source_commit ||
    value.source_commit !== T317_FINAL_SOURCE_COMMIT ||
    value.source_tree !== binding.source_tree ||
    value.source_tree !== T317_FINAL_SOURCE_TREE ||
    value.release_package_sha256 !== binding.release_package_sha256 ||
    value.release_package_sha256 !== T317_FINAL_PACKAGE_SHA256 ||
    value.release_manifest_sha256 !== binding.release_manifest_sha256 ||
    value.release_manifest_sha256 !== T317_FINAL_MANIFEST_SHA256 ||
    !isSha256(value.registry_sha256) ||
    value.technical_case_count !== 80 ||
    !isRecord(value.language_counts) ||
    !exactKeys(value.language_counts, ["en", "zh_hant"]) ||
    value.language_counts.en !== 40 || value.language_counts.zh_hant !== 40 ||
    value.post_window_disabled !== true || value.provider_enabled_after !== false ||
    value.raw_content_retained !== false || value.member_data_used !== false ||
    value.persistence_writes !== 0 || value.units_charged !== 0
  ) return false;
  return true;
}

export async function invokeChatPostDiceReleaseCandidate(input: Readonly<{
  fixture_id: "chat-en-reflection-01" | "chat-zh-hant-reflection-01";
  dice_evidence: unknown;
  binding: T317DiceEvidenceBinding;
  create_transport: () => ChatReleaseCandidateTransport;
}>) {
  if (
    !CHAT_POST_DICE_INTEGRATION_ENABLED ||
    !CHAT_POST_DICE_TRAFFIC_ENABLED ||
    !validateAcceptedT317DiceEvidence(input.dice_evidence, input.binding)
  ) throw new ChatPostDiceReleaseUnavailableError();

  /* c8 ignore next 2 -- separate source activation and receipts are required */
  return invokeChatReleaseCandidate(buildChatReleaseCandidateRequest({ fixture_id: input.fixture_id }), input.create_transport);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function isSha40(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
