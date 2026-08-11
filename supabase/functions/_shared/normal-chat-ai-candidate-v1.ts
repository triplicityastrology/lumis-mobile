export const NORMAL_CHAT_AI_CANDIDATE_SERVER_VERSION = "normal_chat_ai_candidate_server_v1" as const;
export const FINAL_ACCEPTED_DICE_EVIDENCE_SCHEMA = "s2_t296_accepted_dice_v4_technical_evidence_v1" as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;
export const T240_FIXED_FALLBACK = "Lumis couldn’t complete that reflection just now. Please try again." as const;
export const T240_SAFETY_REDIRECT = "Lumis can’t help with that request, but it can offer a safer, general reflection instead." as const;

// A later reviewed commit must bind an accepted evidence digest. JSON supplied
// at runtime cannot activate this source candidate by itself.
export const COMPILED_ACCEPTED_DICE_EVIDENCE_SHA256: string | null = null;
export const NORMAL_CHAT_AI_INTEGRATION_ENABLED = false as const;
export const NORMAL_CHAT_AI_TRAFFIC_ENABLED = false as const;

type ThreadIntent = Readonly<{ mode: "new" } | { mode: "continue"; thread_id: string }>;
export type NormalChatMobileRequest = Readonly<{
  schema_version: "normal_chat_mobile_request_v1";
  client_turn_id: string;
  message: string;
  thread_intent: ThreadIntent;
}>;

type AtomicState = "committed" | "replayed";
export type NormalChatMobileResponse = Readonly<{
  schema_version: "normal_chat_mobile_response_v1";
  request_id: string;
  client_turn_id: string;
  result: "completed" | "duplicate" | "fixed_fallback" | "safety_rejected" | "technical_error";
  thread_id?: string;
  assistant_message?: string;
  error_code?: string;
  persistence: "committed" | "not_committed";
  idempotency_outcome: "committed" | "replayed" | "not_committed";
  units_charged: number;
  atomic_outcome?: Readonly<{
    user_message: AtomicState;
    assistant_message: AtomicState;
    unit_ledger: AtomicState;
    idempotency_outcome: AtomicState;
  }>;
}>;

export type NormalChatCandidateControl = Readonly<{
  integrationEnabled: boolean;
  trafficEnabled: boolean;
  acceptedDiceEvidenceSha256: string | null;
  acceptedChatAuthoritySha256: string | null;
}>;

export type NormalChatCandidateMetadata = Readonly<{
  requestId: string;
  result: NormalChatMobileResponse["result"];
  providerAttempts: 0 | 1 | 2;
  durationBucket: "lt_1s" | "1_to_4s" | "4_to_12s" | "deadline";
  errorCode: string | null;
  retentionDays: 30;
}>;

export type NormalChatCandidateDependencies = Readonly<{
  control: NormalChatCandidateControl;
  diceEvidence: unknown;
  independentlyComputedDiceEvidenceSha256: string;
  resolveAuthenticatedActor(): Promise<{ actorId: string } | null>;
  hasActiveProfile(actorId: string): Promise<boolean>;
  inspectPolicy(input: Readonly<{ actorId: string; request: NormalChatMobileRequest }> ):
    | Readonly<{ kind: "safety" }>
    | Readonly<{ kind: "allowed"; unitsToCharge: number }>;
  findCommittedReplay(input: Readonly<{ actorId: string; clientTurnId: string }>): Promise<AtomicCommit | null>;
  createProviderClient(): NormalChatProviderClient;
  commitAtomicSuccess(input: Readonly<{
    actorId: string;
    request: NormalChatMobileRequest;
    assistantMessage: string;
    unitsToCharge: number;
  }>): Promise<AtomicCommit | null>;
  nextRequestId(): string;
  nowMs(): number;
  recordMetadata(metadata: NormalChatCandidateMetadata): void | Promise<void>;
}>;

export type NormalChatProviderClient = Readonly<{
  complete(input: Readonly<{
    message: string;
    deadlineAtMs: number;
    attempt: 1 | 2;
  }>): Promise<
    | Readonly<{ kind: "completed"; assistantMessage: string }>
    | Readonly<{ kind: "content_filter_block" | "content_filter_partial" }>
    | Readonly<{ kind: "timeout" | "network" | "rate_limited" | "server_error" }>
    | Readonly<{ kind: "unauthorized" | "forbidden" | "malformed" }>
  >;
}>;

export type AtomicCommit = Readonly<{
  threadId: string;
  assistantMessage: string;
  unitsCharged: number;
  state: AtomicState;
}>;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/;
const REQUEST_KEYS = ["schema_version", "client_turn_id", "message", "thread_intent"];

export async function handleNormalChatAiCandidate(
  rawRequest: unknown,
  dependencies: NormalChatCandidateDependencies,
): Promise<NormalChatMobileResponse> {
  const startedAt = dependencies.nowMs();
  const requestId = dependencies.nextRequestId();
  if (!REQUEST_ID.test(requestId)) throw new Error("NORMAL_CHAT_SERVER_REQUEST_ID_INVALID");

  // Admission precedes request parsing, auth/database access and provider/client construction.
  if (
    !NORMAL_CHAT_AI_INTEGRATION_ENABLED || !NORMAL_CHAT_AI_TRAFFIC_ENABLED ||
    !dependencies.control.integrationEnabled || !dependencies.control.trafficEnabled ||
    !validateFinalAcceptedDiceEvidence(
      dependencies.diceEvidence,
      dependencies.independentlyComputedDiceEvidenceSha256,
      dependencies.control.acceptedDiceEvidenceSha256,
    ) ||
    !SHA256.test(dependencies.control.acceptedChatAuthoritySha256 ?? "")
  ) {
    return record(dependencies, technical(requestId, clientTurnIdOrPlaceholder(rawRequest), "NORMAL_CHAT_AI_DISABLED"), 0, startedAt);
  }

  // Deliberately unreachable until a separately authorized source change sets
  // both compile-time switches and an accepted evidence digest.
  /* c8 ignore start */
  const parsed = parseMobileRequest(rawRequest);
  if (!parsed.ok) return record(dependencies, technical(requestId, parsed.clientTurnId, parsed.code), 0, startedAt);
  const request = parsed.request;
  const actor = await dependencies.resolveAuthenticatedActor();
  if (!actor) return record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_AUTH_REQUIRED"), 0, startedAt);
  if (!(await dependencies.hasActiveProfile(actor.actorId))) {
    return record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_ACTIVE_PROFILE_REQUIRED"), 0, startedAt);
  }
  const replay = await dependencies.findCommittedReplay({ actorId: actor.actorId, clientTurnId: request.client_turn_id });
  if (replay) return record(dependencies, committed(requestId, request.client_turn_id, replay, "duplicate"), 0, startedAt);
  const policy = dependencies.inspectPolicy({ actorId: actor.actorId, request });
  if (policy.kind === "safety") {
    return record(dependencies, zeroEffect(requestId, request.client_turn_id, "safety_rejected", "NORMAL_CHAT_SAFETY_REDIRECT", T240_SAFETY_REDIRECT), 0, startedAt);
  }
  if (!Number.isInteger(policy.unitsToCharge) || policy.unitsToCharge < 0) {
    return record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_POLICY_UNAVAILABLE"), 0, startedAt);
  }

  const provider = dependencies.createProviderClient();
  const deadlineAtMs = startedAt + 12_000;
  let attempts: 0 | 1 | 2 = 0;
  for (;;) {
    if (dependencies.nowMs() >= deadlineAtMs) {
      return record(dependencies, zeroEffect(requestId, request.client_turn_id, "fixed_fallback", "NORMAL_CHAT_PROVIDER_UNAVAILABLE", T240_FIXED_FALLBACK), attempts, startedAt);
    }
    attempts = (attempts + 1) as 1 | 2;
    const result = await provider.complete({ message: request.message, deadlineAtMs, attempt: attempts });
    if (result.kind === "completed") {
      const assistantMessage = normalizeAssistantMessage(result.assistantMessage);
      if (!assistantMessage) return record(dependencies, zeroEffect(requestId, request.client_turn_id, "fixed_fallback", "NORMAL_CHAT_PROVIDER_MALFORMED", T240_FIXED_FALLBACK), attempts, startedAt);
      const outcome = await dependencies.commitAtomicSuccess({
        actorId: actor.actorId,
        request,
        assistantMessage,
        unitsToCharge: policy.unitsToCharge,
      });
      if (!outcome) return record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_ATOMIC_COMMIT_FAILED"), attempts, startedAt);
      return record(dependencies, committed(requestId, request.client_turn_id, outcome, outcome.state === "replayed" ? "duplicate" : "completed"), attempts, startedAt);
    }
    if (result.kind === "content_filter_block" || result.kind === "content_filter_partial") {
      return record(dependencies, zeroEffect(requestId, request.client_turn_id, "safety_rejected", "NORMAL_CHAT_SAFETY_REDIRECT", T240_SAFETY_REDIRECT), attempts, startedAt);
    }
    const retryable = ["timeout", "network", "rate_limited", "server_error"].includes(result.kind);
    if (retryable && attempts === 1 && dependencies.nowMs() < deadlineAtMs) continue;
    if (retryable) return record(dependencies, zeroEffect(requestId, request.client_turn_id, "fixed_fallback", "NORMAL_CHAT_PROVIDER_UNAVAILABLE", T240_FIXED_FALLBACK), attempts, startedAt);
    return record(dependencies, technical(requestId, request.client_turn_id, `NORMAL_CHAT_PROVIDER_${result.kind.toUpperCase()}`), attempts, startedAt);
  }
  /* c8 ignore stop */
}

export function validateFinalAcceptedDiceEvidence(value: unknown, computedSha256: string, acceptedSha256: string | null): boolean {
  if (
    COMPILED_ACCEPTED_DICE_EVIDENCE_SHA256 === null ||
    acceptedSha256 !== COMPILED_ACCEPTED_DICE_EVIDENCE_SHA256 || computedSha256 !== acceptedSha256 ||
    !SHA256.test(computedSha256) || !isRecord(value)
  ) return false;
  try {
    exactKeys(value, ["schema", "review_decision", "deployment_receipt", "technical_evidence", "accepted_at"]);
    if (value.schema !== FINAL_ACCEPTED_DICE_EVIDENCE_SCHEMA || value.review_decision !== "accepted" || !isRecord(value.deployment_receipt) || !isRecord(value.technical_evidence)) return false;
    const deployment = value.deployment_receipt;
    const technical = value.technical_evidence;
    exactKeys(deployment, ["schema", "authorization_schema", "project_ref", "function_name", "deployment_id", "source_commit", "runtime_package_sha256", "disabled_probes", "provider_calls", "model_invocations", "kill_switch_disabled", "traffic_switch_disabled", "migration_applied", "deployed_at", "valid_until"]);
    exactKeys(technical, ["schema", "run_id", "deployment_id", "runtime_package_sha256", "migration_proof_receipt_sha256", "registry_sha256", "technical_case_count", "founder_case_count", "language", "attempt_total", "concurrency_peak", "tokenizer", "cost_ceiling_usd", "provider_disabled_verified", "effects", "records"]);
    if (!isRecord(deployment.disabled_probes) || !isRecord(technical.language) || !isRecord(technical.effects) || !Array.isArray(technical.records)) return false;
    exactKeys(deployment.disabled_probes, ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"]);
    exactKeys(technical.language, ["en", "zh-Hant"]);
    exactKeys(technical.effects, ["provider_calls", "model_invocations", "persistence_writes", "units_charged", "finally_disabled", "post_window_disabled_proof_sha256"]);
    return (
      deployment.schema === "s2_t289_accepted_v4_post_deploy_disabled_receipt_v1" &&
      deployment.authorization_schema === "lumis_dice_default_off_function_deployment_authorization_v4" &&
      deployment.project_ref === "bmqhwofmdgebpcihjlnb" && deployment.function_name === "dice-synthetic" &&
      deployment.source_commit === "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432" &&
      deployment.runtime_package_sha256 === "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" &&
      Object.values(deployment.disabled_probes).every((entry) => entry === "DICE_AI_DISABLED") &&
      deployment.provider_calls === 0 && deployment.model_invocations === 0 && deployment.kill_switch_disabled === true &&
      deployment.traffic_switch_disabled === true && deployment.migration_applied === false &&
      technical.schema === "s2_t289_dice_technical_evidence_package_v1" &&
      technical.runtime_package_sha256 === deployment.runtime_package_sha256 && technical.deployment_id === deployment.deployment_id &&
      technical.technical_case_count === 80 && technical.founder_case_count === 0 && technical.language.en === 40 && technical.language["zh-Hant"] === 40 &&
      Number.isInteger(technical.attempt_total) && Number(technical.attempt_total) >= 0 && Number(technical.attempt_total) <= 160 &&
      Number.isInteger(technical.concurrency_peak) && Number(technical.concurrency_peak) >= 1 && Number(technical.concurrency_peak) <= 2 &&
      technical.tokenizer === "js-tiktoken@1.0.21/o200k_base" && technical.cost_ceiling_usd === 0.128 &&
      technical.provider_disabled_verified === true && technical.effects.persistence_writes === 0 && technical.effects.units_charged === 0 &&
      technical.effects.finally_disabled === true && technical.records.length === 80
    );
  } catch {
    return false;
  }
}

// Exported for zero-network transaction/projection fixtures. Production entry
// must call handleNormalChatAiCandidate, which owns admission.
export async function exerciseAuthorizedCoreForOfflineProof(
  rawRequest: unknown,
  dependencies: Omit<NormalChatCandidateDependencies, "control" | "diceEvidence" | "independentlyComputedDiceEvidenceSha256">,
): Promise<NormalChatMobileResponse> {
  const startedAt = dependencies.nowMs();
  const requestId = dependencies.nextRequestId();
  const parsed = parseMobileRequest(rawRequest);
  if (!parsed.ok) return record(dependencies, technical(requestId, parsed.clientTurnId, parsed.code), 0, startedAt);
  const request = parsed.request;
  const actor = await dependencies.resolveAuthenticatedActor();
  if (!actor) return record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_AUTH_REQUIRED"), 0, startedAt);
  if (!(await dependencies.hasActiveProfile(actor.actorId))) return record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_ACTIVE_PROFILE_REQUIRED"), 0, startedAt);
  const replay = await dependencies.findCommittedReplay({ actorId: actor.actorId, clientTurnId: request.client_turn_id });
  if (replay) return record(dependencies, committed(requestId, request.client_turn_id, replay, "duplicate"), 0, startedAt);
  const policy = dependencies.inspectPolicy({ actorId: actor.actorId, request });
  if (policy.kind === "safety") return record(dependencies, zeroEffect(requestId, request.client_turn_id, "safety_rejected", "NORMAL_CHAT_SAFETY_REDIRECT", T240_SAFETY_REDIRECT), 0, startedAt);
  const provider = dependencies.createProviderClient();
  const deadlineAtMs = startedAt + 12_000;
  let attempts: 0 | 1 | 2 = 0;
  for (;;) {
    attempts = (attempts + 1) as 1 | 2;
    const result = await provider.complete({ message: request.message, deadlineAtMs, attempt: attempts });
    if (result.kind === "completed") {
      const assistantMessage = normalizeAssistantMessage(result.assistantMessage);
      if (!assistantMessage) return record(dependencies, zeroEffect(requestId, request.client_turn_id, "fixed_fallback", "NORMAL_CHAT_PROVIDER_MALFORMED", T240_FIXED_FALLBACK), attempts, startedAt);
      const outcome = await dependencies.commitAtomicSuccess({ actorId: actor.actorId, request, assistantMessage, unitsToCharge: policy.unitsToCharge });
      return outcome
        ? record(dependencies, committed(requestId, request.client_turn_id, outcome, outcome.state === "replayed" ? "duplicate" : "completed"), attempts, startedAt)
        : record(dependencies, technical(requestId, request.client_turn_id, "NORMAL_CHAT_ATOMIC_COMMIT_FAILED"), attempts, startedAt);
    }
    if (result.kind === "content_filter_block" || result.kind === "content_filter_partial") return record(dependencies, zeroEffect(requestId, request.client_turn_id, "safety_rejected", "NORMAL_CHAT_SAFETY_REDIRECT", T240_SAFETY_REDIRECT), attempts, startedAt);
    const retryable = ["timeout", "network", "rate_limited", "server_error"].includes(result.kind);
    if (retryable && attempts === 1 && dependencies.nowMs() < deadlineAtMs) continue;
    return retryable
      ? record(dependencies, zeroEffect(requestId, request.client_turn_id, "fixed_fallback", "NORMAL_CHAT_PROVIDER_UNAVAILABLE", T240_FIXED_FALLBACK), attempts, startedAt)
      : record(dependencies, technical(requestId, request.client_turn_id, `NORMAL_CHAT_PROVIDER_${result.kind.toUpperCase()}`), attempts, startedAt);
  }
}

function parseMobileRequest(value: unknown): { ok: true; request: NormalChatMobileRequest } | { ok: false; clientTurnId: string; code: string } {
  const clientTurnId = clientTurnIdOrPlaceholder(value);
  try {
    if (!isRecord(value)) throw new Error();
    exactKeys(value, REQUEST_KEYS);
    if (value.schema_version !== "normal_chat_mobile_request_v1" || typeof value.client_turn_id !== "string" || !UUID_V4.test(value.client_turn_id) || typeof value.message !== "string") throw new Error();
    const message = value.message.normalize("NFC").replace(/\r\n?/g, "\n").trim();
    if (!message || [...message].length > 2_000 || !isRecord(value.thread_intent)) throw new Error();
    if (value.thread_intent.mode === "new") exactKeys(value.thread_intent, ["mode"]);
    else if (value.thread_intent.mode === "continue") {
      exactKeys(value.thread_intent, ["mode", "thread_id"]);
      if (typeof value.thread_intent.thread_id !== "string" || !UUID_V4.test(value.thread_intent.thread_id)) throw new Error();
    } else throw new Error();
    return { ok: true, request: Object.freeze({ ...value, message }) as NormalChatMobileRequest };
  } catch {
    return { ok: false, clientTurnId, code: "NORMAL_CHAT_REQUEST_INVALID" };
  }
}

function committed(requestId: string, clientTurnId: string, outcome: AtomicCommit, result: "completed" | "duplicate"): NormalChatMobileResponse {
  const state = result === "completed" ? "committed" : "replayed";
  if (!UUID_V4.test(outcome.threadId) || !outcome.assistantMessage.trim() || outcome.state !== state) throw new Error("NORMAL_CHAT_ATOMIC_RESULT_INVALID");
  return Object.freeze({
    schema_version: "normal_chat_mobile_response_v1", request_id: requestId, client_turn_id: clientTurnId,
    result, thread_id: outcome.threadId, assistant_message: outcome.assistantMessage,
    persistence: "committed", idempotency_outcome: state, units_charged: result === "duplicate" ? 0 : outcome.unitsCharged,
    atomic_outcome: Object.freeze({ user_message: state, assistant_message: state, unit_ledger: state, idempotency_outcome: state }),
  });
}

function zeroEffect(requestId: string, clientTurnId: string, result: "fixed_fallback" | "safety_rejected", errorCode: string, assistantMessage: string): NormalChatMobileResponse {
  return Object.freeze({ schema_version: "normal_chat_mobile_response_v1", request_id: requestId, client_turn_id: clientTurnId, result, assistant_message: assistantMessage, error_code: errorCode, persistence: "not_committed", idempotency_outcome: "not_committed", units_charged: 0 });
}

function technical(requestId: string, clientTurnId: string, errorCode: string): NormalChatMobileResponse {
  return Object.freeze({ schema_version: "normal_chat_mobile_response_v1", request_id: requestId, client_turn_id: clientTurnId, result: "technical_error", error_code: errorCode, persistence: "not_committed", idempotency_outcome: "not_committed", units_charged: 0 });
}

async function record(dependencies: Pick<NormalChatCandidateDependencies, "recordMetadata" | "nowMs">, response: NormalChatMobileResponse, attempts: 0 | 1 | 2, startedAt: number): Promise<NormalChatMobileResponse> {
  const elapsed = Math.max(0, dependencies.nowMs() - startedAt);
  await dependencies.recordMetadata(Object.freeze({
    requestId: response.request_id,
    result: response.result,
    providerAttempts: attempts,
    durationBucket: elapsed >= 12_000 ? "deadline" : elapsed >= 4_000 ? "4_to_12s" : elapsed >= 1_000 ? "1_to_4s" : "lt_1s",
    errorCode: response.error_code ?? null,
    retentionDays: 30,
  }));
  return response;
}

function normalizeAssistantMessage(value: string): string | null {
  const message = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return message && [...message].length <= 1_200 ? message : null;
}

function clientTurnIdOrPlaceholder(value: unknown): string {
  return isRecord(value) && typeof value.client_turn_id === "string" && UUID_V4.test(value.client_turn_id)
    ? value.client_turn_id
    : "00000000-0000-4000-8000-000000000000";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) throw new Error("NORMAL_CHAT_CLOSED_SCHEMA_VIOLATION");
}
