import {
  CHAT_SYNTHETIC_CAPS,
  CHAT_SYNTHETIC_GATEWAY_VERSION,
  ChatSyntheticRun,
  type ChatSyntheticRequest,
  type ChatSyntheticResponse
} from "./chat-synthetic-gateway-v1.ts";
import { CHAT_TOKENIZER_VERSION } from "./chat-tokenizer-v1.ts";

export const CHAT_SYNTHETIC_GATEWAY_PORT_VERSION = "chat_synthetic_gateway_port_v1" as const;
export const CHAT_CANONICAL_T240_SCHEMA_SHA256 = "0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07" as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

type DiceEvidencePrerequisite = Readonly<{
  schema: "lumis_dice_technical_window_80_accepted_evidence_v4";
  review_decision: "accepted";
  deployment_receipt: Readonly<{
    schema: "lumis_dice_default_off_function_deployment_receipt_v4";
    authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4";
    source_commit: string;
    runtime_package_sha256: string;
    disabled_probes: Readonly<{
      unknown_fixture: "DICE_AI_DISABLED";
      free_form_body: "DICE_AI_DISABLED";
      normal_mobile_body: "DICE_AI_DISABLED";
      allow_listed_fixture: "DICE_AI_DISABLED";
    }>;
    provider_calls: 0;
    model_invocations: 0;
    migration_applied: false;
    post_deploy_disabled: true;
  }>;
  technical_window: Readonly<{
    schema: "lumis_dice_technical_window_80_evidence_v4";
    authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY";
    evidence_package_sha256: string;
    logical_total: 80;
    en: 40;
    zh_hant: 40;
    attempt_total: number;
    max_attempts: 160;
    input_token_limit: 800;
    output_token_limit: 300;
    concurrency_limit: 2;
    shared_deadline_ms: 12000;
    cost_ceiling_usd: 0.128;
    provider_disabled_verified: true;
    finally_disabled: true;
    post_window_disabled_proof_sha256: string;
    founder_cases_run: 0;
    persistence_writes: 0;
    units_charged: 0;
  }>;
  accepted_at: string;
}>;

type ChatWindowAuthority = Readonly<{
  schema: "s2_t260_chat_single_use_authority_v1";
  authority: "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED";
  scope: "closed_fixture_registry_60";
  gateway_interface: typeof CHAT_SYNTHETIC_GATEWAY_PORT_VERSION;
  review_package_sha256: string;
  gateway_source_sha256: string;
  fixture_registry_sha256: string;
  canonical_t240_schema_sha256: typeof CHAT_CANONICAL_T240_SCHEMA_SHA256;
  dice_evidence_sha256: string;
  run_id: string;
  caps: Readonly<{
    logical: 60;
    en: 30;
    zh_hant: 30;
    attempts: 120;
    input_tokens: 1200;
    output_tokens: 300;
    concurrency: 1;
    deadline_ms: 12000;
    retries: 1;
  }>;
  issued_at: string;
  valid_until: string;
}>;

export type ChatSyntheticReviewControl = Readonly<{
  executionAuthority: boolean;
  acceptedDiceEvidenceSha256: string | null;
  acceptedAuthoritySha256: string | null;
  reviewPackageSha256: string;
  gatewaySourceSha256: string;
  fixtureRegistrySha256: string;
}>;

type PortOptions = Readonly<{
  gateway: ChatSyntheticRun;
  authorityStore: ChatSyntheticAuthorityStore;
  control: ChatSyntheticReviewControl;
  nowMs?: () => number;
}>;

export type ChatSyntheticAuthorityStore = Readonly<{
  consumeAuthority(input: Readonly<{
    authoritySha256: string;
    reviewPackageSha256: string;
    runId: string;
    diceEvidenceSha256: string;
    gatewaySourceSha256: string;
    fixtureRegistrySha256: string;
    validUntil: string;
  }>): Promise<"consumed" | "replayed" | "expired" | "conflict">;
  consumeFixture(input: Readonly<{
    authoritySha256: string;
    reviewPackageSha256: string;
    runId: string;
    fixtureId: string;
    idempotencyKey: string;
  }>): Promise<"consumed" | "replayed" | "expired" | "conflict" | "authority_missing">;
  closeAuthority(input: Readonly<{
    authoritySha256: string;
    reviewPackageSha256: string;
    runId: string;
  }>): Promise<"closed" | "already_closed" | "authority_missing" | "conflict">;
}>;

type ActiveAuthority = Readonly<{ receipt: ChatWindowAuthority; receiptSha256: string }>;

const SHA256 = /^[a-f0-9]{64}$/;
const RUN_ID = /^chat-syn-[a-z0-9]{12,32}$/;
const EVIDENCE_KEYS = ["schema", "review_decision", "deployment_receipt", "technical_window", "accepted_at"];
const DEPLOYMENT_EVIDENCE_KEYS = ["schema", "authorization_schema", "source_commit", "runtime_package_sha256", "disabled_probes", "provider_calls", "model_invocations", "migration_applied", "post_deploy_disabled"];
const DISABLED_PROBE_KEYS = ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"];
const TECHNICAL_EVIDENCE_KEYS = ["schema", "authority", "evidence_package_sha256", "logical_total", "en", "zh_hant", "attempt_total", "max_attempts", "input_token_limit", "output_token_limit", "concurrency_limit", "shared_deadline_ms", "cost_ceiling_usd", "provider_disabled_verified", "finally_disabled", "post_window_disabled_proof_sha256", "founder_cases_run", "persistence_writes", "units_charged"];
const AUTHORITY_KEYS = ["schema", "authority", "scope", "gateway_interface", "review_package_sha256", "gateway_source_sha256", "fixture_registry_sha256", "canonical_t240_schema_sha256", "dice_evidence_sha256", "run_id", "caps", "issued_at", "valid_until"];
const CAP_KEYS = ["logical", "en", "zh_hant", "attempts", "input_tokens", "output_tokens", "concurrency", "deadline_ms", "retries"];
const REQUEST_KEYS = ["fixture_id", "idempotency_key", "run_id"];

export class ChatSyntheticPortError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ChatSyntheticPortError";
  }
}

export class ChatSyntheticGatewayPortV1 {
  readonly #gateway: ChatSyntheticRun;
  readonly #authorityStore: ChatSyntheticAuthorityStore;
  readonly #control: ChatSyntheticReviewControl;
  readonly #nowMs: () => number;
  #active: ActiveAuthority | null = null;

  constructor(options: PortOptions) {
    this.#gateway = options.gateway;
    this.#authorityStore = options.authorityStore;
    this.#control = options.control;
    this.#nowMs = options.nowMs ?? Date.now;
  }

  describe() {
    return Object.freeze({
      interface_version: CHAT_SYNTHETIC_GATEWAY_PORT_VERSION,
      gateway_version: CHAT_SYNTHETIC_GATEWAY_VERSION,
      route: "chat-synthetic",
      fixture_registry_sha256: this.#control.fixtureRegistrySha256,
      canonical_t240_schema_sha256: CHAT_CANONICAL_T240_SCHEMA_SHA256,
      tokenizer: CHAT_TOKENIZER_VERSION,
      normal_chat_connected: false
    });
  }

  status() {
    return Object.freeze({
      authority_active: this.#active !== null,
      provider_access: this.#active !== null,
      route_default_off: this.#active === null,
      normal_chat_connected: false
    });
  }

  async authorize(input: Readonly<{
    diceEvidence: unknown;
    diceEvidenceSha256: string;
    authority: unknown;
    authoritySha256: string;
  }>): Promise<void> {
    validateAcceptedDiceEvidence(input.diceEvidence, input.diceEvidenceSha256, this.#control);
    const authority = validateChatAuthority(input.authority, input.authoritySha256, input.diceEvidenceSha256, this.#control, this.#nowMs());
    if (this.#active) fail("CHAT_SYNTHETIC_AUTHORITY_REPLAYED");
    const outcome = await storeCall(() => this.#authorityStore.consumeAuthority({
      authoritySha256: input.authoritySha256,
      reviewPackageSha256: authority.review_package_sha256,
      runId: authority.run_id,
      diceEvidenceSha256: authority.dice_evidence_sha256,
      gatewaySourceSha256: authority.gateway_source_sha256,
      fixtureRegistrySha256: authority.fixture_registry_sha256,
      validUntil: authority.valid_until
    }));
    // A matching durable replay restores the same single-use authority on a new
    // stateless Edge instance; fixture claims still enforce one execution.
    if (outcome !== "consumed" && outcome !== "replayed") fail("CHAT_SYNTHETIC_AUTHORITY_STORE_REJECTED");
    this.#active = Object.freeze({ receipt: authority, receiptSha256: input.authoritySha256 });
  }

  async invokeFixture(raw: unknown): Promise<ChatSyntheticResponse> {
    const active = this.#active;
    if (!active) fail("CHAT_SYNTHETIC_AUTHORITY_REQUIRED");
    const request = exactRequest(raw);
    if (request.run_id !== active.receipt.run_id) fail("CHAT_SYNTHETIC_RUN_ID_INVALID");
    const outcome = await storeCall(() => this.#authorityStore.consumeFixture({
      authoritySha256: active.receiptSha256,
      reviewPackageSha256: active.receipt.review_package_sha256,
      runId: request.run_id,
      fixtureId: request.fixture_id,
      idempotencyKey: request.idempotency_key
    }));
    if (outcome !== "consumed") {
      if (outcome === "replayed") fail("CHAT_SYNTHETIC_FIXTURE_REPLAYED");
      if (outcome === "conflict") fail("CHAT_SYNTHETIC_FIXTURE_ALREADY_USED");
      fail("CHAT_SYNTHETIC_AUTHORITY_STORE_REJECTED");
    }
    return this.#gateway.handle(request);
  }

  async disable(runId: string): Promise<void> {
    const active = this.#active;
    if (!active || active.receipt.run_id !== runId) fail("CHAT_SYNTHETIC_RUN_ID_INVALID");
    const outcome = await storeCall(() => this.#authorityStore.closeAuthority({
      authoritySha256: active.receiptSha256,
      reviewPackageSha256: active.receipt.review_package_sha256,
      runId
    }));
    if (outcome !== "closed") fail("CHAT_SYNTHETIC_AUTHORITY_STORE_REJECTED");
    this.#active = null;
  }
}

export function validateAcceptedDiceEvidence(value: unknown, checksum: string, control: ChatSyntheticReviewControl): DiceEvidencePrerequisite {
  exactRecord(value, EVIDENCE_KEYS, "CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID");
  const evidence = value as DiceEvidencePrerequisite;
  exactRecord(evidence.deployment_receipt, DEPLOYMENT_EVIDENCE_KEYS, "CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID");
  exactRecord(evidence.deployment_receipt.disabled_probes, DISABLED_PROBE_KEYS, "CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID");
  exactRecord(evidence.technical_window, TECHNICAL_EVIDENCE_KEYS, "CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID");
  const deployment = evidence.deployment_receipt;
  const technical = evidence.technical_window;
  if (
    !SHA256.test(checksum) || control.acceptedDiceEvidenceSha256 !== checksum ||
    evidence.schema !== "lumis_dice_technical_window_80_accepted_evidence_v4" || evidence.review_decision !== "accepted" ||
    deployment.schema !== "lumis_dice_default_off_function_deployment_receipt_v4" ||
    deployment.authorization_schema !== "lumis_dice_default_off_function_deployment_authorization_v4" ||
    !/^[a-f0-9]{40}$/.test(deployment.source_commit) || /^0+$/.test(deployment.source_commit) ||
    deployment.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" ||
    Object.values(deployment.disabled_probes).some((code) => code !== "DICE_AI_DISABLED") || deployment.provider_calls !== 0 ||
    deployment.model_invocations !== 0 || deployment.migration_applied !== false || deployment.post_deploy_disabled !== true ||
    technical.schema !== "lumis_dice_technical_window_80_evidence_v4" ||
    technical.authority !== "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY" || !SHA256.test(technical.evidence_package_sha256) ||
    technical.logical_total !== 80 || technical.en !== 40 || technical.zh_hant !== 40 ||
    !Number.isInteger(technical.attempt_total) || technical.attempt_total < 0 || technical.attempt_total > 160 ||
    technical.max_attempts !== 160 || technical.input_token_limit !== 800 || technical.output_token_limit !== 300 ||
    technical.concurrency_limit !== 2 || technical.shared_deadline_ms !== 12000 || technical.cost_ceiling_usd !== 0.128 ||
    technical.provider_disabled_verified !== true || technical.finally_disabled !== true ||
    !SHA256.test(technical.post_window_disabled_proof_sha256) || technical.founder_cases_run !== 0 ||
    technical.persistence_writes !== 0 || technical.units_charged !== 0 ||
    !Number.isFinite(Date.parse(evidence.accepted_at))
  ) fail("CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID");
  return Object.freeze({
    ...evidence,
    deployment_receipt: Object.freeze({ ...deployment, disabled_probes: Object.freeze({ ...deployment.disabled_probes }) }),
    technical_window: Object.freeze({ ...technical })
  });
}

function validateChatAuthority(value: unknown, checksum: string, diceChecksum: string, control: ChatSyntheticReviewControl, now: number): ChatWindowAuthority {
  exactRecord(value, AUTHORITY_KEYS, "CHAT_SYNTHETIC_AUTHORITY_INVALID");
  const authority = value as ChatWindowAuthority;
  exactRecord(authority.caps, CAP_KEYS, "CHAT_SYNTHETIC_AUTHORITY_INVALID");
  const caps = authority.caps;
  const issued = Date.parse(authority.issued_at);
  const expires = Date.parse(authority.valid_until);
  if (
    control.executionAuthority !== true || !SHA256.test(checksum) || control.acceptedAuthoritySha256 !== checksum ||
    authority.schema !== "s2_t260_chat_single_use_authority_v1" || authority.authority !== "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED" ||
    authority.scope !== "closed_fixture_registry_60" || authority.gateway_interface !== CHAT_SYNTHETIC_GATEWAY_PORT_VERSION ||
    authority.review_package_sha256 !== control.reviewPackageSha256 || !SHA256.test(authority.review_package_sha256) ||
    authority.gateway_source_sha256 !== control.gatewaySourceSha256 || authority.fixture_registry_sha256 !== control.fixtureRegistrySha256 ||
    authority.canonical_t240_schema_sha256 !== CHAT_CANONICAL_T240_SCHEMA_SHA256 || authority.dice_evidence_sha256 !== diceChecksum ||
    !RUN_ID.test(authority.run_id) || !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now ||
    caps.logical !== CHAT_SYNTHETIC_CAPS.logicalRequests || caps.en !== CHAT_SYNTHETIC_CAPS.enRequests || caps.zh_hant !== CHAT_SYNTHETIC_CAPS.zhHantRequests ||
    caps.attempts !== CHAT_SYNTHETIC_CAPS.providerAttempts || caps.input_tokens !== CHAT_SYNTHETIC_CAPS.inputTokens || caps.output_tokens !== CHAT_SYNTHETIC_CAPS.outputTokens ||
    caps.concurrency !== CHAT_SYNTHETIC_CAPS.concurrency || caps.deadline_ms !== CHAT_SYNTHETIC_CAPS.deadlineMs || caps.retries !== CHAT_SYNTHETIC_CAPS.retries
  ) fail("CHAT_SYNTHETIC_AUTHORITY_INVALID");
  return Object.freeze({ ...authority, caps: Object.freeze({ ...caps }) });
}

function exactRequest(value: unknown): ChatSyntheticRequest {
  exactRecord(value, REQUEST_KEYS, "CHAT_SYNTHETIC_INVALID_REQUEST");
  const request = value as ChatSyntheticRequest;
  if (typeof request.fixture_id !== "string" || typeof request.idempotency_key !== "string" || typeof request.run_id !== "string") {
    fail("CHAT_SYNTHETIC_INVALID_REQUEST");
  }
  return request;
}

function exactRecord(value: unknown, keys: readonly string[], code: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const actual = Object.keys(value as Record<string, unknown>);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(code);
}

function fail(code: string): never {
  throw new ChatSyntheticPortError(code);
}

async function storeCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    fail("CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE");
  }
}
