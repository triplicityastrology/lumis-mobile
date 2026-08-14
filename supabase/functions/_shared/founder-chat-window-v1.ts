import { getChatSyntheticFixture } from "./chat-synthetic-registry-v1.ts";

export const FOUNDER_CHAT_WINDOW_VERSION = "founder_chat_synthetic_window_v1" as const;
export const ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256 =
  "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612" as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

export const FOUNDER_CHAT_FIXTURE_IDS = Object.freeze([
  "chat_en_small_decision_v1",
  "chat_zh_hant_small_decision_v1",
  "chat_en_difficult_conversation_v1",
  "chat_zh_hant_difficult_conversation_v1",
  "chat_en_uncertain_change_v1",
  "chat_zh_hant_uncertain_change_v1",
  "chat_en_rest_without_guilt_v1",
  "chat_zh_hant_rest_without_guilt_v1",
  "chat_en_boundary_v1",
  "chat_zh_hant_boundary_v1",
  "chat_en_unsafe_medical_v1",
  "chat_zh_hant_unsafe_medical_v1",
] as const);

const RECEIPT_KEYS = [
  "schema", "scope", "authorization_sha256", "run_id", "microsoft_contract_commit",
  "microsoft_contract_seal_sha256", "integrated_contract_seal_sha256",
  "source_provenance_manifest_sha256", "prompt_version", "result_schema",
  "technical_cases", "language", "founder_cases", "attempts", "attempt_cap",
  "concurrency_cap", "eligible_retries", "shared_deadline_ms", "input_token_cap",
  "output_token_cap", "tokenizer", "guardrail", "cost_upper_bound_usd",
  "cost_ceiling_usd", "evidence_sha256", "finally_disable_executed",
  "provider_disabled_verified", "ambiguous_redispatches", "units_charged",
  "persistence_writes", "recorded_at",
] as const;

const AUTHORITY_KEYS = [
  "schema", "decision", "scope", "accepted_dice_evidence_sha256", "review_package_sha256",
  "fixture_ids", "caps", "issued_at", "valid_until", "normal_chat_integration_authorized",
  "member_traffic_authorized", "persistence_authorized", "units_authorized",
] as const;

export function validateAcceptedTechnical80Evidence(value: unknown, sha256: string): void {
  exactRecord(value, RECEIPT_KEYS, "FOUNDER_CHAT_DICE_EVIDENCE_INVALID");
  exactRecord(value.language, ["en", "zh-Hant"], "FOUNDER_CHAT_DICE_EVIDENCE_INVALID");
  if (
    sha256 !== ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256 ||
    value.schema !== "s2_t345_technical_80_metadata_receipt_v1" ||
    value.scope !== "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY" ||
    value.run_id !== "dice-tech80-981f8f6406cc3c86b2c939ce" ||
    value.microsoft_contract_commit !== "c1ec632fdea1f2677621f8b1bd3a71e72d17f071" ||
    value.microsoft_contract_seal_sha256 !== "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c" ||
    value.prompt_version !== "lumis_dice_v0_3_prompt_v2" || value.result_schema !== "lumis_dice_v0_3_result_v2" ||
    value.technical_cases !== 80 || value.language.en !== 40 || value.language["zh-Hant"] !== 40 ||
    value.founder_cases !== 0 || !Number.isInteger(value.attempts) || value.attempts < 80 || value.attempts > 160 ||
    value.attempt_cap !== 160 || value.concurrency_cap !== 2 || value.eligible_retries !== 1 ||
    value.shared_deadline_ms !== 12000 || value.input_token_cap !== 800 || value.output_token_cap !== 300 ||
    value.tokenizer !== "js-tiktoken@1.0.21/o200k_base" || value.guardrail !== "Microsoft.DefaultV2" ||
    typeof value.cost_upper_bound_usd !== "number" || value.cost_upper_bound_usd > 0.128 ||
    value.cost_ceiling_usd !== 0.128 || value.finally_disable_executed !== true ||
    value.provider_disabled_verified !== true || value.ambiguous_redispatches !== 0 ||
    value.units_charged !== 0 || value.persistence_writes !== 0 || !Number.isFinite(Date.parse(String(value.recorded_at)))
  ) throw new Error("FOUNDER_CHAT_DICE_EVIDENCE_INVALID");
}

export function validateFounderChatWindowAuthority(value: unknown, nowMs: number, packageSha256: string): void {
  exactRecord(value, AUTHORITY_KEYS, "FOUNDER_CHAT_WINDOW_AUTHORITY_INVALID");
  exactRecord(value.caps, ["logical", "en", "zh_hant", "attempts", "concurrency", "deadline_ms", "retries", "input_tokens", "output_tokens"], "FOUNDER_CHAT_WINDOW_AUTHORITY_INVALID");
  const fixtureIds = value.fixture_ids;
  if (!Array.isArray(fixtureIds) || fixtureIds.length !== FOUNDER_CHAT_FIXTURE_IDS.length ||
      fixtureIds.some((entry, index) => entry !== FOUNDER_CHAT_FIXTURE_IDS[index]) ||
      fixtureIds.some((entry) => !getChatSyntheticFixture(String(entry)))) {
    throw new Error("FOUNDER_CHAT_WINDOW_AUTHORITY_INVALID");
  }
  const issued = Date.parse(String(value.issued_at));
  const expires = Date.parse(String(value.valid_until));
  if (
    value.schema !== "lumis_founder_chat_synthetic_window_authorization_v1" || value.decision !== "AUTHORIZED" ||
    value.scope !== "FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY" ||
    value.accepted_dice_evidence_sha256 !== ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256 ||
    value.review_package_sha256 !== packageSha256 || !/^[a-f0-9]{64}$/.test(packageSha256) ||
    value.caps.logical !== 12 || value.caps.en !== 6 || value.caps.zh_hant !== 6 ||
    value.caps.attempts !== 24 || value.caps.concurrency !== 1 || value.caps.deadline_ms !== 12000 ||
    value.caps.retries !== 1 || value.caps.input_tokens !== 1200 || value.caps.output_tokens !== 300 ||
    !Number.isFinite(issued) || !Number.isFinite(expires) || issued > nowMs || expires <= nowMs || expires - issued > 900_000 ||
    value.normal_chat_integration_authorized !== false || value.member_traffic_authorized !== false ||
    value.persistence_authorized !== false || value.units_authorized !== false
  ) throw new Error("FOUNDER_CHAT_WINDOW_AUTHORITY_INVALID");
}

function exactRecord(value: unknown, keys: readonly string[], code: string): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  const actual = Object.keys(value as Record<string, unknown>);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) throw new Error(code);
}
