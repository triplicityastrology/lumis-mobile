import {
  DICE_AUTHORIZATION_SCHEMA,
  DICE_EVIDENCE_SCHEMA,
  DICE_GATEWAY_INTERFACE_VERSION,
  DICE_LIMITS,
  DICE_PROMPT_VERSION,
  DICE_REGISTRY_VERSION,
  DICE_RESPONSE_SCHEMA,
  assembleCanonicalDicePrompt,
  canonicalDiceRegistry,
  isCanonicalFixtureId,
  parseCanonicalDiceOutput,
  type CanonicalDiceFixture,
  type DiceFailureCode,
  type DiceLanguage,
  type DiceResultClass,
} from "./dice-synthetic-canonical-v1.ts";
import { diceServerTokenizer, measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";
import type { DiceAuthorityStore } from "./dice-authority-store-v1.ts";
import type { DiceV03QuestionShape } from "./dice-v0-3-interpretation-contract.ts";

export type DiceProviderResult =
  | Readonly<{ kind: "success"; content: string; provider_disposition: "responses_completed_valid" }>
  | Readonly<{ kind: "content_filter_block" | "content_filter_partial"; provider_disposition?: DiceProviderDisposition }>
  | Readonly<{ kind: "timeout" | "network" | "rate_limited" | "server_error" }>
  | Readonly<{ kind: "authentication" | "permission" }>
  | Readonly<{ kind: "invalid_output"; provider_disposition: Exclude<DiceProviderDisposition, "responses_completed_valid"> }>;

export type DiceProviderDisposition =
  | "http_400_text_format_schema"
  | "http_non_2xx"
  | "responses_incomplete_content_filter"
  | "responses_incomplete_max_output"
  | "responses_incomplete_other"
  | "responses_completed_empty_output"
  | "responses_completed_non_text_output"
  | "responses_completed_schema_invalid"
  | "responses_completed_valid";

export interface DiceProviderAdapter {
  invoke(input: Readonly<{
    prompt: string;
    prompt_version: typeof DICE_PROMPT_VERSION;
    language: DiceLanguage;
    question_shape: DiceV03QuestionShape;
    deadline_at_ms: number;
    max_output_tokens: 300;
    signal: AbortSignal;
  }>): Promise<DiceProviderResult>;
}

export type DiceDeploymentAuthorization = Readonly<{
  schema: typeof DICE_AUTHORIZATION_SCHEMA;
  interface_version: typeof DICE_GATEWAY_INTERFACE_VERSION;
  authorization_scope: "technical_80_only";
  single_use_run_id: string;
  issued_at: string;
  valid_until: string;
  gateway_package_sha256: string;
  fixture_registry_sha256: string;
  technical_case_count: 80;
  founder_execution: false;
  authorization_hmac_sha256: string;
}>;

export type DiceGatewayStatus = Readonly<{
  interface_version: "dice_synthetic_gateway_status_v1";
  lumis_ai_enabled: boolean;
  provider_access: boolean;
  route_default_off: true;
  active_run_id: string | null;
}>;

export type DiceMetadataEvidence = Readonly<{
  schema: typeof DICE_EVIDENCE_SCHEMA;
  run_id: string;
  fixture_id: string;
  phase: "technical";
  language: DiceLanguage;
  result_class: DiceResultClass;
  attempt_count: 0 | 1 | 2;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  concurrency_peak: number;
  redacted_failure_code: DiceFailureCode;
  observed_at: string;
  retain_until: string;
  effects: Readonly<{ normal_routes: 0; units_charged: 0; persistence_writes: 0 }>;
}>;

export type DiceEvidencePackage = Readonly<{
  schema: "lumis_dice_synthetic_metadata_evidence_package_v1";
  run_id: string;
  technical_case_count: 80;
  founder_case_count: 0;
  attempt_total: number;
  tokenizer_vocabulary: string;
  provider_disabled_verified: true;
  records: readonly DiceMetadataEvidence[];
}>;

type Clock = Readonly<{ now(): number }>;
type ManifestAuthority = Readonly<{ gatewayPackageSha256: string; fixtureRegistrySha256: string }>;

export class DiceGatewayStop extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DiceGatewayStop";
  }
}

export class DiceSyntheticGatewayPortV1 {
  private enabled = false;
  private authorityAdmissionInFlight = false;
  private activeRunId: string | null = null;
  private attemptTotal = 0;
  private activeProviderCalls = 0;
  private concurrencyPeak = 0;
  private windowAbort: AbortController | null = null;
  private activeValidUntilMs: number | null = null;

  constructor(
    private readonly adapter: DiceProviderAdapter,
    private readonly authorityStore: DiceAuthorityStore,
    private readonly authoritySecret: string,
    private readonly manifest: ManifestAuthority,
    private readonly clock: Clock = { now: () => Date.now() },
  ) {
    if (authoritySecret.length < 32) throw new DiceGatewayStop("DICE_AUTHORITY_SECRET_INVALID");
  }

  describe() {
    return Object.freeze({
      interface_version: DICE_GATEWAY_INTERFACE_VERSION,
      registry_version: DICE_REGISTRY_VERSION,
      prompt_version: DICE_PROMPT_VERSION,
      response_schema: DICE_RESPONSE_SCHEMA,
      gateway_package_sha256: this.manifest.gatewayPackageSha256,
      fixture_registry_sha256: this.manifest.fixtureRegistrySha256,
      technical_case_count: DICE_LIMITS.technicalCases,
      founder_case_count: DICE_LIMITS.founderCasesExecutable,
      normal_routes: 0,
      units_charged: 0,
      persistence_writes: 0,
    });
  }

  status(): DiceGatewayStatus {
    return Object.freeze({
      interface_version: "dice_synthetic_gateway_status_v1",
      lumis_ai_enabled: this.enabled,
      provider_access: this.enabled,
      route_default_off: true,
      active_run_id: this.activeRunId,
    });
  }

  async executeAuthorizedWindow(rawAuthorization: unknown): Promise<DiceEvidencePackage> {
    const authorization = await this.validateAndConsumeAuthorization(rawAuthorization);
    this.enabled = true;
    this.activeRunId = authorization.single_use_run_id;
    this.attemptTotal = 0;
    this.activeProviderCalls = 0;
    this.concurrencyPeak = 0;
    this.windowAbort = new AbortController();
    this.activeValidUntilMs = Date.parse(authorization.valid_until);
    const records = new Array<DiceMetadataEvidence>(DICE_LIMITS.technicalCases);
    let thrown: unknown;
    try {
      let nextIndex = 0;
      let firstFailure: unknown;
      const worker = async () => {
        while (nextIndex < canonicalDiceRegistry.technicalFixtures.length) {
          const index = nextIndex;
          nextIndex += 1;
          try {
            records[index] = await this.executeFixture(authorization.single_use_run_id, canonicalDiceRegistry.technicalFixtures[index]);
          } catch (error) {
            firstFailure ??= error;
            this.disableImmediately();
            throw error;
          }
        }
      };
      await Promise.allSettled(Array.from({ length: DICE_LIMITS.concurrency }, () => worker()));
      if (firstFailure) throw firstFailure;
      if (records.some((record) => !record)) throw new DiceGatewayStop("DICE_TECHNICAL_80_INCOMPLETE");
    } catch (error) {
      thrown = error;
    } finally {
      this.disableImmediately();
    }
    if (!verifyDiceGatewayDisabled(this.status())) throw new DiceGatewayStop("DICE_DISABLE_NOT_VERIFIABLE");
    if (thrown) throw thrown;
    return Object.freeze({
      schema: "lumis_dice_synthetic_metadata_evidence_package_v1",
      run_id: authorization.single_use_run_id,
      technical_case_count: 80,
      founder_case_count: 0,
      attempt_total: this.attemptTotal,
      tokenizer_vocabulary: diceServerTokenizer.version,
      provider_disabled_verified: true,
      records: Object.freeze(records),
    });
  }

  async invokeFixture(): Promise<never> {
    throw new DiceGatewayStop("DICE_DIRECT_FIXTURE_EXECUTION_PROHIBITED");
  }

  private async validateAndConsumeAuthorization(raw: unknown): Promise<DiceDeploymentAuthorization> {
    const authorization = parseAuthorization(raw);
    if (authorization.gateway_package_sha256 !== this.manifest.gatewayPackageSha256 ||
        authorization.fixture_registry_sha256 !== this.manifest.fixtureRegistrySha256) {
      throw new DiceGatewayStop("DICE_AUTHORITY_PACKAGE_MISMATCH");
    }
    const now = this.clock.now();
    const issuedAt = Date.parse(authorization.issued_at);
    const validUntil = Date.parse(authorization.valid_until);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(validUntil) || issuedAt > now || validUntil <= now ||
        validUntil > issuedAt + DICE_LIMITS.authorizationMaxFutureMs) {
      throw new DiceGatewayStop("DICE_AUTHORITY_EXPIRED_OR_OVERBROAD");
    }
    const expected = await hmacSha256(this.authoritySecret, authorizationPayload(authorization));
    if (!constantTimeHexEqual(expected, authorization.authorization_hmac_sha256)) {
      throw new DiceGatewayStop("DICE_AUTHORITY_SIGNATURE_INVALID");
    }
    if (this.enabled || this.authorityAdmissionInFlight) throw new DiceGatewayStop("DICE_GATEWAY_BUSY");
    this.authorityAdmissionInFlight = true;
    let consumption: Awaited<ReturnType<DiceAuthorityStore["consume"]>>;
    try {
      consumption = await this.authorityStore.consume({
        run_id: authorization.single_use_run_id,
        gateway_package_sha256: authorization.gateway_package_sha256,
        fixture_registry_sha256: authorization.fixture_registry_sha256,
        authorization_hmac_sha256: authorization.authorization_hmac_sha256,
        issued_at: authorization.issued_at,
        valid_until: authorization.valid_until,
      });
    } catch {
      throw new DiceGatewayStop("DICE_AUTHORITY_STORE_UNAVAILABLE");
    } finally {
      this.authorityAdmissionInFlight = false;
    }
    if (consumption.kind === "replayed") throw new DiceGatewayStop("DICE_AUTHORITY_REPLAYED");
    if (consumption.kind === "denied") throw new DiceGatewayStop("DICE_AUTHORITY_CONSUMPTION_DENIED");
    if (consumption.kind !== "consumed" || consumption.run_id !== authorization.single_use_run_id) {
      throw new DiceGatewayStop("DICE_AUTHORITY_STORE_UNAVAILABLE");
    }
    return authorization;
  }

  private async executeFixture(runId: string, fixture: CanonicalDiceFixture): Promise<DiceMetadataEvidence> {
    if (!this.enabled || this.activeRunId !== runId || fixture.phase !== "technical" ||
        canonicalDiceRegistry.isFounderProhibited(fixture.fixture_id) || !isCanonicalFixtureId(fixture.fixture_id)) {
      throw new DiceGatewayStop("DICE_FIXTURE_AUTHORITY_INVALID");
    }
    this.assertActiveAuthority();
    const startedAt = this.clock.now();
    const deadlineAt = startedAt + DICE_LIMITS.caseDeadlineMs;
    const prompt = assembleCanonicalDicePrompt(fixture);
    const inputMeasurement = measureDiceTokenLimit(prompt, DICE_LIMITS.inputTokens);
    const inputTokens = inputMeasurement.token_count;
    if (!inputMeasurement.within_limit) {
      return this.evidence(runId, fixture, 0, inputTokens, 0, startedAt, "technical_error", "input_token_cap");
    }
    if (fixture.expected_result_class === "safety") {
      return this.evidence(runId, fixture, 0, inputTokens, 0, startedAt, "safety", "safety_block");
    }
    if (fixture.expected_result_class === "excluded") {
      return this.evidence(runId, fixture, 0, inputTokens, 0, startedAt, "excluded", "scope_excluded");
    }

    let attempts: 0 | 1 | 2 = 0;
    for (let retry = 0; retry <= DICE_LIMITS.retries; retry += 1) {
      this.assertActiveAuthority();
      if (this.clock.now() >= deadlineAt) {
        return this.evidence(runId, fixture, attempts, inputTokens, 0, startedAt, "fallback", "provider_timeout");
      }
      if (this.attemptTotal >= DICE_LIMITS.providerAttempts) {
        return this.evidence(runId, fixture, attempts, inputTokens, 0, startedAt, "technical_error", "attempt_cap");
      }
      this.attemptTotal += 1;
      attempts = (attempts + 1) as 1 | 2;
      const provider = await this.callProvider(prompt, fixture.language, fixture.classification, deadlineAt);
      if (provider.kind === "success") {
        const outputMeasurement = measureDiceTokenLimit(provider.content, DICE_LIMITS.outputTokens);
        const outputTokens = outputMeasurement.token_count;
        if (!outputMeasurement.within_limit) {
          return this.evidence(runId, fixture, attempts, inputTokens, outputTokens, startedAt, "fallback", "output_token_cap");
        }
        if (!parseCanonicalDiceOutput(provider.content, fixture)) {
          return this.evidence(runId, fixture, attempts, inputTokens, outputTokens, startedAt, "fallback", "provider_malformed");
        }
        return this.evidence(runId, fixture, attempts, inputTokens, outputTokens, startedAt, "completed", "none");
      }
      const disposition = providerDisposition(provider.kind);
      if (!disposition.retryable || retry === DICE_LIMITS.retries) {
        return this.evidence(runId, fixture, attempts, inputTokens, 0, startedAt, disposition.result, disposition.code);
      }
    }
    throw new DiceGatewayStop("DICE_RETRY_LOOP_INVALID");
  }

  private async callProvider(prompt: string, language: DiceLanguage, questionShape: DiceV03QuestionShape, deadlineAt: number): Promise<DiceProviderResult> {
    this.activeProviderCalls += 1;
    this.concurrencyPeak = Math.max(this.concurrencyPeak, this.activeProviderCalls);
    if (this.activeProviderCalls > DICE_LIMITS.concurrency) throw new DiceGatewayStop("DICE_CONCURRENCY_CAP");
    const remaining = Math.max(0, deadlineAt - this.clock.now());
    const controller = new AbortController();
    const windowSignal = this.windowAbort?.signal;
    const abortFromWindow = () => controller.abort();
    windowSignal?.addEventListener("abort", abortFromWindow, { once: true });
    if (windowSignal?.aborted) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resolveAbort: (() => void) | undefined;
    try {
      const invocation = this.adapter.invoke({
        prompt,
        prompt_version: DICE_PROMPT_VERSION,
        language,
        question_shape: questionShape,
        deadline_at_ms: deadlineAt,
        max_output_tokens: 300,
        signal: controller.signal,
      });
      const deadline = new Promise<DiceProviderResult>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ kind: "timeout" });
        }, remaining);
      });
      const aborted = new Promise<DiceProviderResult>((resolve) => {
        resolveAbort = () => resolve({ kind: "timeout" });
        controller.signal.addEventListener("abort", resolveAbort, { once: true });
        if (controller.signal.aborted) resolveAbort();
      });
      return await Promise.race([invocation, deadline, aborted]);
    } catch {
      return { kind: "network" };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (resolveAbort) controller.signal.removeEventListener("abort", resolveAbort);
      windowSignal?.removeEventListener("abort", abortFromWindow);
      controller.abort();
      this.activeProviderCalls -= 1;
    }
  }

  private evidence(
    runId: string,
    fixture: CanonicalDiceFixture,
    attempts: 0 | 1 | 2,
    inputTokens: number,
    outputTokens: number,
    startedAt: number,
    result: DiceResultClass,
    code: DiceFailureCode,
  ): DiceMetadataEvidence {
    const observedAt = this.clock.now();
    return Object.freeze({
      schema: DICE_EVIDENCE_SCHEMA,
      run_id: runId,
      fixture_id: fixture.fixture_id,
      phase: "technical",
      language: fixture.language,
      result_class: result,
      attempt_count: attempts,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      duration_ms: Math.min(DICE_LIMITS.caseDeadlineMs, Math.max(0, observedAt - startedAt)),
      concurrency_peak: this.concurrencyPeak,
      redacted_failure_code: code,
      observed_at: new Date(observedAt).toISOString(),
      retain_until: new Date(observedAt + DICE_LIMITS.evidenceRetentionDays * 86_400_000).toISOString(),
      effects: Object.freeze({ normal_routes: 0, units_charged: 0, persistence_writes: 0 }),
    });
  }

  private disableImmediately(): void {
    this.enabled = false;
    this.activeRunId = null;
    this.activeValidUntilMs = null;
    this.windowAbort?.abort();
    this.windowAbort = null;
  }

  private assertActiveAuthority(): void {
    if (this.activeValidUntilMs === null || this.clock.now() >= this.activeValidUntilMs) {
      throw new DiceGatewayStop("DICE_AUTHORITY_EXPIRED_DURING_RUN");
    }
  }
}

export function verifyDiceGatewayDisabled(value: unknown): value is DiceGatewayStatus {
  if (!isRecord(value) || !hasExactKeys(value, ["interface_version", "lumis_ai_enabled", "provider_access", "route_default_off", "active_run_id"])) return false;
  return value.interface_version === "dice_synthetic_gateway_status_v1" && value.lumis_ai_enabled === false &&
    value.provider_access === false && value.route_default_off === true && value.active_run_id === null;
}

export async function signDiceDeploymentAuthorization(
  value: Omit<DiceDeploymentAuthorization, "authorization_hmac_sha256">,
  authoritySecret: string,
): Promise<DiceDeploymentAuthorization> {
  return Object.freeze({ ...value, authorization_hmac_sha256: await hmacSha256(authoritySecret, authorizationPayload(value)) });
}

function parseAuthorization(raw: unknown): DiceDeploymentAuthorization {
  const keys = ["schema", "interface_version", "authorization_scope", "single_use_run_id", "issued_at", "valid_until", "gateway_package_sha256", "fixture_registry_sha256", "technical_case_count", "founder_execution", "authorization_hmac_sha256"];
  if (!isRecord(raw) || !hasExactKeys(raw, keys) || raw.schema !== DICE_AUTHORIZATION_SCHEMA ||
      raw.interface_version !== DICE_GATEWAY_INTERFACE_VERSION || raw.authorization_scope !== "technical_80_only" ||
      typeof raw.single_use_run_id !== "string" || !/^dice-tech80-[a-z0-9]{16,40}$/.test(raw.single_use_run_id) ||
      typeof raw.issued_at !== "string" || typeof raw.valid_until !== "string" || typeof raw.gateway_package_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.gateway_package_sha256) ||
      typeof raw.fixture_registry_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.fixture_registry_sha256) ||
      raw.technical_case_count !== 80 || raw.founder_execution !== false ||
      typeof raw.authorization_hmac_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.authorization_hmac_sha256)) {
    throw new DiceGatewayStop("DICE_AUTHORITY_SCHEMA_INVALID");
  }
  return raw as DiceDeploymentAuthorization;
}

function authorizationPayload(value: Omit<DiceDeploymentAuthorization, "authorization_hmac_sha256">): string {
  return JSON.stringify({
    schema: value.schema,
    interface_version: value.interface_version,
    authorization_scope: value.authorization_scope,
    single_use_run_id: value.single_use_run_id,
    issued_at: value.issued_at,
    valid_until: value.valid_until,
    gateway_package_sha256: value.gateway_package_sha256,
    fixture_registry_sha256: value.fixture_registry_sha256,
    technical_case_count: value.technical_case_count,
    founder_execution: value.founder_execution,
  });
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function providerDisposition(kind: Exclude<DiceProviderResult, { kind: "success" }>["kind"]): { retryable: boolean; result: DiceResultClass; code: DiceFailureCode } {
  if (kind === "content_filter_block") return { retryable: false, result: "safety", code: "defaultv2_block" };
  if (kind === "content_filter_partial") return { retryable: false, result: "safety", code: "defaultv2_partial" };
  if (kind === "authentication") return { retryable: false, result: "technical_error", code: "provider_authentication" };
  if (kind === "permission") return { retryable: false, result: "technical_error", code: "provider_permission" };
  if (kind === "invalid_output") return { retryable: false, result: "fallback", code: "provider_malformed" };
  if (kind === "timeout") return { retryable: true, result: "fallback", code: "provider_timeout" };
  if (kind === "rate_limited") return { retryable: true, result: "fallback", code: "provider_rate_limited" };
  return { retryable: true, result: "fallback", code: "provider_unavailable" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const closed = [...expected].sort();
  return actual.length === closed.length && actual.every((key, index) => key === closed[index]);
}
