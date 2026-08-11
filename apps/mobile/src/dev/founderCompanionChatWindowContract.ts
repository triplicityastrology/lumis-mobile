import {
  CANONICAL_T240_SCHEMA_SHA256,
  CHAT_SYNTHETIC_GATEWAY_INTERFACE,
  COMPANION_FIXTURE_IDS,
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  canonicalJson,
  type CompanionLanguage,
  type CompanionRatings,
  type CompanionResult,
  type CompanionVerdictEntry,
} from "./founderCompanionChatContract";

export const FOUNDER_CHAT_WINDOW_VERSION = "s2_t271_founder_chat_window_v1" as const;
export const DOCUMENTED_CHAT_RUNTIME_COMMIT = "3bc762c05cf10589bc2ec27ee3e4fd23a1ce6da9" as const;
export const FINAL_DICE_RUNTIME_COMMIT = "f5f9e9da238633d84eb8695307c573eef8f1bc96" as const;
export const FINAL_DICE_RUNTIME_CONTROL_SHA256 = "b8d22c7c4677e654a83764f5499ddecb9bc97f327e115205ffd13848b5537be1" as const;
export const FINAL_DICE_RUNTIME_PROOF_SHA256 = "3f44ef8c674ae70037f1e34ffde9f0efb70862ee1bc4b158cadbeae50efe1256" as const;
export const FINAL_DICE_TECHNICAL_AUTHORITY = "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY" as const;
export const ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256: string | null = null;
export const ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256: string | null = null;
export const ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256: string | null = null;
export const ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256: string | null = null;

export type FounderChatSurface = "companion" | "normal_chat";
export type WindowEvidenceState = "not_yet_run" | "offline_preview" | "live_synthetic";

export type DiceEvidenceInspection = Readonly<{
  structurally_valid: boolean;
  accepted: boolean;
  code: "DICE_EVIDENCE_VALID_NOT_ACCEPTED" | "DICE_EVIDENCE_ACCEPTED" | "DICE_EVIDENCE_INVALID";
  evidence_sha256: string | null;
}>;

export type ChatWindowAuthorizationRequest = Readonly<{
  schema_version: "founder_chat_window_authorization_request_v1";
  build_sha: string;
  gateway_interface: typeof CHAT_SYNTHETIC_GATEWAY_INTERFACE;
  chat_runtime_commit: typeof DOCUMENTED_CHAT_RUNTIME_COMMIT;
  dice_runtime_commit: typeof FINAL_DICE_RUNTIME_COMMIT;
  dice_runtime_control_sha256: typeof FINAL_DICE_RUNTIME_CONTROL_SHA256;
  dice_runtime_proof_sha256: typeof FINAL_DICE_RUNTIME_PROOF_SHA256;
  dice_technical_authority: typeof FINAL_DICE_TECHNICAL_AUTHORITY;
  canonical_t240_schema_sha256: typeof CANONICAL_T240_SCHEMA_SHA256;
  accepted_dice_evidence_sha256: string;
  fixture_export_sha256: string;
  requested_fixture_count: 60;
  language_counts: Readonly<{ en: 30; zh_hant: 30 }>;
  runtime_request_fields: readonly ["fixture_id"];
  effects: Readonly<{ member_data: false; persistence_writes: 0; units_charged: 0 }>;
  authority_status: Readonly<{
    normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY";
    azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY";
  }>;
}>;

export type FounderWindowRecord = Readonly<{
  schema_version: typeof FOUNDER_CHAT_WINDOW_VERSION;
  fixture_id: string;
  surface: FounderChatSurface;
  language: CompanionLanguage;
  state: WindowEvidenceState;
  result: CompanionResult;
  assistant_message: string | null;
  idempotency_outcome: "not_run" | "not_committed";
  units_charged: 0;
  persistence_writes: 0;
  provider_diagnostics: null;
}>;

export type PostWindowDisabledProof = Readonly<{
  schema_version: "founder_chat_post_window_disabled_v1";
  authorization_sha256: string;
  execution_evidence_sha256: string;
  status: "disabled";
  provider_enabled: false;
  residual_access: false;
  provider_calls_after_disable: 0;
  checked_at_bucket: "same_controlled_window";
}>;

const SHA256 = /^[a-f0-9]{64}$/;
const BUILD_SHA = /^[a-f0-9]{40}$/;
const COMPANION_SLUGS = new Set([
  "small_decision", "difficult_conversation", "uncertain_change", "rest_without_guilt", "comparison",
  "unfinished_task", "mixed_feelings", "boundary", "asking_for_help", "quiet_progress",
  "disappointment", "overthinking", "friendship_distance", "new_beginning", "perfectionism",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) throw new Error(code);
}

function fixtureLanguage(fixtureId: string): CompanionLanguage {
  return fixtureId.startsWith("chat_zh_hant_") ? "zh-Hant" : "en";
}

function fixtureSlug(fixtureId: string): string {
  return fixtureId.replace(/^chat_(?:en|zh_hant)_/, "").replace(/_v1$/, "");
}

function assertFixtureId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !COMPANION_FIXTURE_IDS.includes(value)) throw new Error("STOP_S2_T271_FIXTURE_ID");
}

export function surfaceForFixture(fixtureId: string): FounderChatSurface {
  assertFixtureId(fixtureId);
  return COMPANION_SLUGS.has(fixtureSlug(fixtureId)) ? "companion" : "normal_chat";
}

export const FOUNDER_CHAT_FIXTURE_SETS = Object.freeze({
  companion: Object.freeze(COMPANION_FIXTURE_IDS.filter((id) => surfaceForFixture(id) === "companion")),
  normal_chat: Object.freeze(COMPANION_FIXTURE_IDS.filter((id) => surfaceForFixture(id) === "normal_chat")),
});

export function inspectDiceTechnicalEvidence(input: unknown, independentlyComputedSha256: string): DiceEvidenceInspection {
  try {
    if (!isObject(input)) throw new Error("invalid");
    exactKeys(input, ["schema", "review_decision", "runtime_source_commit", "runtime_control_sha256", "runtime_proof_sha256", "technical_window_authority", "technical_evidence_package_sha256", "logical_total", "en", "zh_hant", "provider_disabled_verified", "founder_cases_run", "persistence_writes", "units_charged", "accepted_at"], "invalid");
    if (input.schema !== "lumis_dice_technical_window_acceptance_v2" || input.review_decision !== "accepted" ||
      input.runtime_source_commit !== FINAL_DICE_RUNTIME_COMMIT || input.runtime_control_sha256 !== FINAL_DICE_RUNTIME_CONTROL_SHA256 ||
      input.runtime_proof_sha256 !== FINAL_DICE_RUNTIME_PROOF_SHA256 || input.technical_window_authority !== FINAL_DICE_TECHNICAL_AUTHORITY ||
      !SHA256.test(independentlyComputedSha256)) throw new Error("invalid");
    if (!SHA256.test(input.technical_evidence_package_sha256 as string) || input.logical_total !== 80 || input.en !== 40 || input.zh_hant !== 40 ||
      input.provider_disabled_verified !== true || input.founder_cases_run !== 0 || input.persistence_writes !== 0 || input.units_charged !== 0 ||
      !Number.isFinite(Date.parse(input.accepted_at as string))) throw new Error("invalid");
    const accepted = ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256 !== null && independentlyComputedSha256 === ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256;
    return Object.freeze({ structurally_valid: true, accepted, code: accepted ? "DICE_EVIDENCE_ACCEPTED" : "DICE_EVIDENCE_VALID_NOT_ACCEPTED", evidence_sha256: independentlyComputedSha256 });
  } catch {
    return Object.freeze({ structurally_valid: false, accepted: false, code: "DICE_EVIDENCE_INVALID", evidence_sha256: null });
  }
}

export function createChatWindowAuthorizationRequest(input: Readonly<{
  buildSha: string;
  acceptedDiceEvidenceSha256: string;
  fixtureExportSha256: string;
}>): ChatWindowAuthorizationRequest {
  if (!BUILD_SHA.test(input.buildSha) || !SHA256.test(input.fixtureExportSha256)) throw new Error("STOP_S2_T271_AUTHORIZATION_REQUEST_INPUT");
  if (ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256 === null || input.acceptedDiceEvidenceSha256 !== ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256) {
    throw new Error("STOP_S2_T271_DICE_EVIDENCE_NOT_ACCEPTED");
  }
  return Object.freeze({
    schema_version: "founder_chat_window_authorization_request_v1",
    build_sha: input.buildSha,
    gateway_interface: CHAT_SYNTHETIC_GATEWAY_INTERFACE,
    chat_runtime_commit: DOCUMENTED_CHAT_RUNTIME_COMMIT,
    dice_runtime_commit: FINAL_DICE_RUNTIME_COMMIT,
    dice_runtime_control_sha256: FINAL_DICE_RUNTIME_CONTROL_SHA256,
    dice_runtime_proof_sha256: FINAL_DICE_RUNTIME_PROOF_SHA256,
    dice_technical_authority: FINAL_DICE_TECHNICAL_AUTHORITY,
    canonical_t240_schema_sha256: CANONICAL_T240_SCHEMA_SHA256,
    accepted_dice_evidence_sha256: input.acceptedDiceEvidenceSha256,
    fixture_export_sha256: input.fixtureExportSha256,
    requested_fixture_count: 60,
    language_counts: Object.freeze({ en: 30, zh_hant: 30 }),
    runtime_request_fields: Object.freeze(["fixture_id"] as const),
    effects: Object.freeze({ member_data: false as const, persistence_writes: 0 as const, units_charged: 0 as const }),
    authority_status: Object.freeze({ normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const, azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY" as const }),
  });
}

export function createAuthorizedFixtureInvocation(input: unknown, authorizationSha256: string): Readonly<{ fixture_id: string }> {
  if (!isObject(input)) throw new Error("STOP_S2_T271_RUNTIME_ID_ONLY");
  exactKeys(input, ["fixture_id"], "STOP_S2_T271_RUNTIME_ID_ONLY");
  assertFixtureId(input.fixture_id);
  if (ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256 === null || authorizationSha256 !== ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256) {
    throw new Error("STOP_S2_T271_WINDOW_NOT_AUTHORIZED");
  }
  return Object.freeze({ fixture_id: input.fixture_id });
}

function parseWindowRecord(input: unknown, allowLive: boolean): FounderWindowRecord {
  if (!isObject(input)) throw new Error("STOP_S2_T271_RECORD_NOT_OBJECT");
  exactKeys(input, ["schema_version", "fixture_id", "surface", "language", "state", "result", "assistant_message", "idempotency_outcome", "units_charged", "persistence_writes", "provider_diagnostics"], "STOP_S2_T271_RECORD_FIELDS");
  assertFixtureId(input.fixture_id);
  if (input.schema_version !== FOUNDER_CHAT_WINDOW_VERSION || input.surface !== surfaceForFixture(input.fixture_id) || input.language !== fixtureLanguage(input.fixture_id) ||
    !["not_yet_run", "offline_preview", "live_synthetic"].includes(input.state as string) ||
    !["not_run", "completed", "fixed_fallback", "safety_rejected", "technical_error"].includes(input.result as string) ||
    input.units_charged !== 0 || input.persistence_writes !== 0 || input.provider_diagnostics !== null) throw new Error("STOP_S2_T271_RECORD_INVALID");
  if (input.state === "live_synthetic" && !allowLive) throw new Error("STOP_S2_T271_LIVE_EVIDENCE_REQUIRED");
  if (input.state === "not_yet_run" && (input.result !== "not_run" || input.assistant_message !== null || input.idempotency_outcome !== "not_run")) throw new Error("STOP_S2_T271_NOT_RUN_INVALID");
  if (input.state !== "not_yet_run" && (input.result === "not_run" || input.idempotency_outcome !== "not_committed")) throw new Error("STOP_S2_T271_EFFECT_INVALID");
  if (input.result === "completed" && (typeof input.assistant_message !== "string" || input.assistant_message.length < 1 || input.assistant_message.length > 1200)) throw new Error("STOP_S2_T271_COMPLETED_INVALID");
  if (input.result === "fixed_fallback" && input.assistant_message !== T240_FIXED_FALLBACK) throw new Error("STOP_S2_T271_FALLBACK_INVALID");
  if (input.result === "safety_rejected" && input.assistant_message !== T240_SAFETY_REDIRECT) throw new Error("STOP_S2_T271_SAFETY_INVALID");
  if (input.result === "technical_error" && input.assistant_message !== null) throw new Error("STOP_S2_T271_TECHNICAL_INVALID");
  return Object.freeze({ ...input }) as FounderWindowRecord;
}

export function parseEmbeddedWindowRecord(input: unknown): FounderWindowRecord {
  return parseWindowRecord(input, false);
}

export function importAcceptedWindowExecution(input: unknown, independentlyComputedSha256: string): FounderWindowRecord {
  if (!isObject(input)) throw new Error("STOP_S2_T271_EXECUTION_NOT_OBJECT");
  exactKeys(input, ["schema_version", "evidence_sha256", "authorization_sha256", "status", "response"], "STOP_S2_T271_EXECUTION_FIELDS");
  if (input.schema_version !== "founder_chat_window_execution_evidence_v1" || input.status !== "accepted" ||
    input.evidence_sha256 !== independentlyComputedSha256 || ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256 === null || independentlyComputedSha256 !== ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256 ||
    ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256 === null || input.authorization_sha256 !== ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256) {
    throw new Error("STOP_S2_T271_EXECUTION_NOT_ACCEPTED");
  }
  return parseWindowRecord(input.response, true);
}

export function inspectPostWindowDisabledProof(input: unknown, independentlyComputedSha256: string): Readonly<{ accepted: boolean; code: string }> {
  try {
    if (!isObject(input)) throw new Error("invalid");
    exactKeys(input, ["schema_version", "authorization_sha256", "execution_evidence_sha256", "status", "provider_enabled", "residual_access", "provider_calls_after_disable", "checked_at_bucket"], "invalid");
    if (input.schema_version !== "founder_chat_post_window_disabled_v1" || input.status !== "disabled" || input.provider_enabled !== false || input.residual_access !== false ||
      input.provider_calls_after_disable !== 0 || input.checked_at_bucket !== "same_controlled_window" || !SHA256.test(independentlyComputedSha256) ||
      input.authorization_sha256 !== ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256 || input.execution_evidence_sha256 !== ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256) throw new Error("invalid");
    const accepted = ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256 !== null && independentlyComputedSha256 === ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256;
    return Object.freeze({ accepted, code: accepted ? "POST_WINDOW_DISABLED_ACCEPTED" : "POST_WINDOW_DISABLED_VALID_NOT_ACCEPTED" });
  } catch {
    return Object.freeze({ accepted: false, code: "POST_WINDOW_DISABLED_INVALID" });
  }
}

export const WINDOW_PREVIEW_RECORDS = Object.freeze([
  parseEmbeddedWindowRecord({
    schema_version: FOUNDER_CHAT_WINDOW_VERSION, fixture_id: "chat_en_small_decision_v1", surface: "companion", language: "en", state: "offline_preview", result: "completed",
    assistant_message: "Notice what feels most grounded, then choose one small step that remains yours.", idempotency_outcome: "not_committed", units_charged: 0, persistence_writes: 0, provider_diagnostics: null,
  }),
  parseEmbeddedWindowRecord({
    schema_version: FOUNDER_CHAT_WINDOW_VERSION, fixture_id: "chat_zh_hant_rest_without_guilt_v1", surface: "companion", language: "zh-Hant", state: "offline_preview", result: "completed",
    assistant_message: "先留意甚麼讓你感到最踏實，再選擇一個仍由你決定的小步驟。", idempotency_outcome: "not_committed", units_charged: 0, persistence_writes: 0, provider_diagnostics: null,
  }),
  parseEmbeddedWindowRecord({
    schema_version: FOUNDER_CHAT_WINDOW_VERSION, fixture_id: "chat_en_work_tension_v1", surface: "normal_chat", language: "en", state: "offline_preview", result: "completed",
    assistant_message: "Separate what you know from what you are assuming, then decide which clarification would reduce the most uncertainty.", idempotency_outcome: "not_committed", units_charged: 0, persistence_writes: 0, provider_diagnostics: null,
  }),
  parseEmbeddedWindowRecord({
    schema_version: FOUNDER_CHAT_WINDOW_VERSION, fixture_id: "chat_zh_hant_waiting_v1", surface: "normal_chat", language: "zh-Hant", state: "offline_preview", result: "completed",
    assistant_message: "把目前可以行動的部分，和需要等待的部分分開，讓下一步更清楚。", idempotency_outcome: "not_committed", units_charged: 0, persistence_writes: 0, provider_diagnostics: null,
  }),
]);

export function createFounderWindowVerdict(input: Readonly<{
  buildSha: string;
  fixtureExportSha256: string;
  acceptedExecutionEvidenceSha256: string | null;
  postWindowDisabledProofSha256: string | null;
  entries: readonly (CompanionVerdictEntry & Readonly<{ surface: FounderChatSurface }>)[];
}>) {
  if (!BUILD_SHA.test(input.buildSha) || !SHA256.test(input.fixtureExportSha256)) throw new Error("STOP_S2_T271_VERDICT_INPUT");
  if (input.acceptedExecutionEvidenceSha256 !== null && input.acceptedExecutionEvidenceSha256 !== ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256) throw new Error("STOP_S2_T271_VERDICT_EXECUTION");
  if (input.postWindowDisabledProofSha256 !== null && input.postWindowDisabledProofSha256 !== ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256) throw new Error("STOP_S2_T271_VERDICT_DISABLED_PROOF");
  const seen = new Set<string>();
  for (const entry of input.entries) {
    assertFixtureId(entry.fixture_id);
    if (seen.has(entry.fixture_id) || entry.surface !== surfaceForFixture(entry.fixture_id) || entry.language !== fixtureLanguage(entry.fixture_id)) throw new Error("STOP_S2_T271_VERDICT_ENTRY");
    seen.add(entry.fixture_id);
    for (const rating of Object.values(entry.ratings as CompanionRatings)) if (![1, 2, 3, 4, 5].includes(rating)) throw new Error("STOP_S2_T271_VERDICT_RATING");
  }
  return Object.freeze({
    schema_version: "founder_chat_window_verdict_v1" as const,
    build_sha: input.buildSha,
    chat_runtime_commit: DOCUMENTED_CHAT_RUNTIME_COMMIT,
    dice_runtime_commit: FINAL_DICE_RUNTIME_COMMIT,
    fixture_export_sha256: input.fixtureExportSha256,
    accepted_execution_evidence_sha256: input.acceptedExecutionEvidenceSha256,
    post_window_disabled_proof_sha256: input.postWindowDisabledProofSha256,
    authority_status: Object.freeze({ normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const, azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY" as const }),
    entries: Object.freeze([...input.entries].sort((a, b) => a.fixture_id.localeCompare(b.fixture_id))),
  });
}

export { canonicalJson };
