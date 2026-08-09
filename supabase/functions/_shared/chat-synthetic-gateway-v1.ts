import {
  getChatSyntheticFixture,
  listChatSyntheticFixtureIds,
  type ChatSyntheticFixture,
  type SyntheticExpectedClass,
  type SyntheticLanguage
} from "./chat-synthetic-registry-v1.ts";
import {
  COMPANION_SYNTHETIC_PROMPT_VERSION,
  assembleCompanionSyntheticPrompt,
  serializeCompanionSyntheticPrompt
} from "./companion-synthetic-prompt-v1.ts";

export const CHAT_SYNTHETIC_GATEWAY_VERSION = "chat_synthetic_gateway_v1" as const;
export const CHAT_SYNTHETIC_PROVIDER_ALIAS = "lumis-ai-chat-stg" as const;
export const CHAT_SYNTHETIC_SAFETY_PROFILE = "DefaultV2" as const;
export const CHAT_SYNTHETIC_FALLBACK =
  "Lumis couldn’t complete that reflection just now. Please try again." as const;
export const CHAT_SYNTHETIC_SAFETY_REDIRECT =
  "Lumis can’t help with that request, but it can offer a safer, general reflection instead." as const;

export const CHAT_SYNTHETIC_CAPS = Object.freeze({
  logicalRequests: 60,
  enRequests: 30,
  zhHantRequests: 30,
  providerAttempts: 120,
  inputTokens: 1200,
  outputTokens: 300,
  concurrency: 1,
  deadlineMs: 12_000,
  retries: 1,
  telemetryRetentionDays: 30
});

export type { ChatSyntheticFixture, SyntheticExpectedClass, SyntheticLanguage };
const REQUEST_KEYS = new Set(["fixture_id", "idempotency_key", "run_id"]);
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const RUN_ID_PATTERN = /^chat-syn-[a-z0-9]{8,32}$/;

export type ChatSyntheticRequest = {
  fixture_id: string;
  idempotency_key: string;
  run_id: string;
};

export type ChatSyntheticResult =
  | "completed"
  | "duplicate"
  | "fixed_fallback"
  | "safety_rejected"
  | "technical_error";

export type ChatSyntheticResponse = {
  schema_version: "chat_synthetic_response_v1";
  fixture_id: string;
  language: SyntheticLanguage;
  result: ChatSyntheticResult;
  assistant_message?: string;
  idempotency_outcome: "completed" | "replayed" | "not_committed";
  units_charged: 0;
  persistence: "not_committed";
  provider_attempts: 0 | 1 | 2;
  error_code?: string;
};

export type ProviderResult =
  | { kind: "completed"; assistantMessage: string; outputTokens: number }
  | { kind: "content_filter_block" | "content_filter_partial" }
  | { kind: "timeout" | "network" | "rate_limited" | "server_error" }
  | { kind: "unauthorized" | "forbidden" | "malformed" };

export type ChatSyntheticAdapter = {
  complete(input: {
    providerAlias: typeof CHAT_SYNTHETIC_PROVIDER_ALIAS;
    safetyProfile: typeof CHAT_SYNTHETIC_SAFETY_PROFILE;
    promptVersion: typeof COMPANION_SYNTHETIC_PROMPT_VERSION;
    language: SyntheticLanguage;
    promptInput: string;
    maxOutputTokens: 300;
    deadlineAtMs: number;
  }): Promise<ProviderResult>;
};

export type ChatSyntheticTelemetry = Readonly<{
  fixtureId: string;
  language: SyntheticLanguage;
  result: ChatSyntheticResult;
  attemptCount: number;
  durationBucket: "lt_1s" | "1_to_4s" | "4_to_12s" | "deadline";
  runId: string;
  failureCode: string | null;
  retentionDays: 30;
}>;

export type ChatSyntheticPorts = {
  aiEnabled: false | true;
  adapter: ChatSyntheticAdapter;
  nowMs: () => number;
  recordMetadata: (event: ChatSyntheticTelemetry) => void | Promise<void>;
};

type Counters = {
  logical: number;
  en: number;
  zhHant: number;
  attempts: number;
  active: number;
};

export class ChatSyntheticRun {
  readonly #ports: ChatSyntheticPorts;
  readonly #counters: Counters = { logical: 0, en: 0, zhHant: 0, attempts: 0, active: 0 };
  readonly #inFlight = new Map<string, Promise<ChatSyntheticResponse>>();
  readonly #settled = new Map<string, ChatSyntheticResponse>();

  constructor(ports: ChatSyntheticPorts) {
    this.#ports = ports;
  }

  getSafeCounters(): Readonly<Counters> {
    return Object.freeze({ ...this.#counters });
  }

  async handle(raw: unknown): Promise<ChatSyntheticResponse> {
    const parsed = parseRequest(raw);
    if (!parsed.ok) {
      return technical("unknown", "en", parsed.error, 0);
    }

    const { request, fixture } = parsed;
    const replay = this.#settled.get(request.idempotency_key);
    if (replay) {
      return { ...replay, result: "duplicate", idempotency_outcome: "replayed", provider_attempts: 0 };
    }
    const concurrent = this.#inFlight.get(request.idempotency_key);
    if (concurrent) {
      const completed = await concurrent;
      return { ...completed, result: "duplicate", idempotency_outcome: "replayed", provider_attempts: 0 };
    }

    const promise = this.#execute(request, fixture);
    this.#inFlight.set(request.idempotency_key, promise);
    try {
      const result = await promise;
      if (result.result === "completed") this.#settled.set(request.idempotency_key, result);
      return result;
    } finally {
      this.#inFlight.delete(request.idempotency_key);
    }
  }

  async #execute(request: ChatSyntheticRequest, fixture: ChatSyntheticFixture): Promise<ChatSyntheticResponse> {
    const startedAt = this.#ports.nowMs();
    let result: ChatSyntheticResponse;

    if (!this.#ports.aiEnabled) {
      result = technical(fixture.id, fixture.language, "CHAT_SYNTHETIC_PROVIDER_DISABLED", 0);
      await this.#record(request, result, startedAt);
      return result;
    }
    if (estimateTokens(fixture.serverPromptInput) > CHAT_SYNTHETIC_CAPS.inputTokens) {
      result = technical(fixture.id, fixture.language, "CHAT_SYNTHETIC_INPUT_LIMIT", 0);
      await this.#record(request, result, startedAt);
      return result;
    }
    const languageCount = fixture.language === "en" ? this.#counters.en : this.#counters.zhHant;
    if (
      this.#counters.logical >= CHAT_SYNTHETIC_CAPS.logicalRequests ||
      languageCount >= (fixture.language === "en" ? CHAT_SYNTHETIC_CAPS.enRequests : CHAT_SYNTHETIC_CAPS.zhHantRequests)
    ) {
      result = technical(fixture.id, fixture.language, "CHAT_SYNTHETIC_LOGICAL_CAP", 0);
      await this.#record(request, result, startedAt);
      return result;
    }
    this.#counters.logical += 1;
    if (fixture.language === "en") this.#counters.en += 1;
    else this.#counters.zhHant += 1;
    if (fixture.expectedClass === "safety") {
      result = zeroEffect(fixture, "safety_rejected", CHAT_SYNTHETIC_SAFETY_REDIRECT, "CHAT_SYNTHETIC_SAFETY_REDIRECT", 0);
      await this.#record(request, result, startedAt);
      return result;
    }
    if (this.#counters.active >= CHAT_SYNTHETIC_CAPS.concurrency) {
      result = technical(fixture.id, fixture.language, "CHAT_SYNTHETIC_CONCURRENCY_CAP", 0);
      await this.#record(request, result, startedAt);
      return result;
    }
    this.#counters.active += 1;
    const deadlineAtMs = startedAt + CHAT_SYNTHETIC_CAPS.deadlineMs;
    let attempts: 0 | 1 | 2 = 0;

    try {
      for (;;) {
        if (this.#ports.nowMs() >= deadlineAtMs || this.#counters.attempts >= CHAT_SYNTHETIC_CAPS.providerAttempts) {
          result = fallback(fixture, attempts, "CHAT_SYNTHETIC_DEADLINE_OR_ATTEMPT_CAP");
          break;
        }
        attempts = (attempts + 1) as 1 | 2;
        this.#counters.attempts += 1;
        const providerResult = await this.#ports.adapter.complete({
          providerAlias: CHAT_SYNTHETIC_PROVIDER_ALIAS,
          safetyProfile: CHAT_SYNTHETIC_SAFETY_PROFILE,
          promptVersion: COMPANION_SYNTHETIC_PROMPT_VERSION,
          language: fixture.language,
          promptInput: serializeCompanionSyntheticPrompt(assembleCompanionSyntheticPrompt(fixture)),
          maxOutputTokens: CHAT_SYNTHETIC_CAPS.outputTokens,
          deadlineAtMs
        });

        if (providerResult.kind === "completed") {
          const message = normalizeAssistantMessage(providerResult.assistantMessage);
          if (message && !passesDeterministicPostSafety(message)) {
            result = zeroEffect(fixture, "safety_rejected", CHAT_SYNTHETIC_SAFETY_REDIRECT, "CHAT_SYNTHETIC_POST_SAFETY", attempts);
          } else {
            result = message && providerResult.outputTokens <= CHAT_SYNTHETIC_CAPS.outputTokens
              ? completed(fixture, message, attempts)
              : fallback(fixture, attempts, "CHAT_SYNTHETIC_OUTPUT_INVALID");
          }
          break;
        }
        if (providerResult.kind === "content_filter_block" || providerResult.kind === "content_filter_partial") {
          result = zeroEffect(fixture, "safety_rejected", CHAT_SYNTHETIC_SAFETY_REDIRECT, "CHAT_SYNTHETIC_CONTENT_FILTER", attempts);
          break;
        }
        const retryable = ["timeout", "network", "rate_limited", "server_error"].includes(providerResult.kind);
        if (retryable && attempts === 1 && this.#ports.nowMs() < deadlineAtMs) continue;
        result = retryable
          ? fallback(fixture, attempts, "CHAT_SYNTHETIC_PROVIDER_UNAVAILABLE")
          : technical(fixture.id, fixture.language, `CHAT_SYNTHETIC_${providerResult.kind.toUpperCase()}`, attempts);
        break;
      }
    } finally {
      this.#counters.active -= 1;
    }

    await this.#record(request, result!, startedAt);
    return result!;
  }

  async #record(request: ChatSyntheticRequest, response: ChatSyntheticResponse, startedAt: number) {
    const elapsed = Math.max(0, this.#ports.nowMs() - startedAt);
    await this.#ports.recordMetadata(Object.freeze({
      fixtureId: response.fixture_id,
      language: response.language,
      result: response.result,
      attemptCount: response.provider_attempts,
      durationBucket: elapsed >= CHAT_SYNTHETIC_CAPS.deadlineMs ? "deadline" : elapsed >= 4000 ? "4_to_12s" : elapsed >= 1000 ? "1_to_4s" : "lt_1s",
      runId: request.run_id,
      failureCode: response.error_code ?? null,
      retentionDays: 30
    }));
  }
}

export { listChatSyntheticFixtureIds };

function parseRequest(raw: unknown): { ok: true; request: ChatSyntheticRequest; fixture: ChatSyntheticFixture } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "CHAT_SYNTHETIC_INVALID_REQUEST" };
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => !REQUEST_KEYS.has(key)) || Object.keys(value).length !== 3) {
    return { ok: false, error: "CHAT_SYNTHETIC_UNKNOWN_FIELD" };
  }
  if (typeof value.fixture_id !== "string" || typeof value.idempotency_key !== "string" || typeof value.run_id !== "string") {
    return { ok: false, error: "CHAT_SYNTHETIC_INVALID_REQUEST" };
  }
  const fixture = getChatSyntheticFixture(value.fixture_id);
  if (!fixture) return { ok: false, error: "CHAT_SYNTHETIC_FIXTURE_NOT_ALLOWED" };
  if (!IDEMPOTENCY_PATTERN.test(value.idempotency_key) || !RUN_ID_PATTERN.test(value.run_id)) {
    return { ok: false, error: "CHAT_SYNTHETIC_INVALID_REQUEST" };
  }
  return { ok: true, request: value as ChatSyntheticRequest, fixture };
}

function completed(fixture: ChatSyntheticFixture, assistantMessage: string, attempts: 1 | 2): ChatSyntheticResponse {
  return base(fixture, { result: "completed", assistant_message: assistantMessage, idempotency_outcome: "completed", provider_attempts: attempts });
}

function fallback(fixture: ChatSyntheticFixture, attempts: 0 | 1 | 2, code: string): ChatSyntheticResponse {
  return zeroEffect(fixture, "fixed_fallback", CHAT_SYNTHETIC_FALLBACK, code, attempts);
}

function zeroEffect(fixture: ChatSyntheticFixture, result: "fixed_fallback" | "safety_rejected", message: string, code: string, attempts: 0 | 1 | 2): ChatSyntheticResponse {
  return base(fixture, { result, assistant_message: message, idempotency_outcome: "not_committed", provider_attempts: attempts, error_code: code });
}

function technical(fixtureId: string, language: SyntheticLanguage, code: string, attempts: 0 | 1 | 2): ChatSyntheticResponse {
  return base({ id: fixtureId, language } as ChatSyntheticFixture, { result: "technical_error", idempotency_outcome: "not_committed", provider_attempts: attempts, error_code: code });
}

function base(fixture: ChatSyntheticFixture, value: Pick<ChatSyntheticResponse, "result" | "idempotency_outcome" | "provider_attempts"> & Partial<ChatSyntheticResponse>): ChatSyntheticResponse {
  return {
    schema_version: "chat_synthetic_response_v1",
    fixture_id: fixture.id,
    language: fixture.language,
    persistence: "not_committed",
    units_charged: 0,
    ...value
  };
}

function normalizeAssistantMessage(value: string): string | null {
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return normalized.length > 0 && normalized.length <= 1800 ? normalized : null;
}

function estimateTokens(value: string): number {
  return Math.ceil(Array.from(value).length / 3);
}

function passesDeterministicPostSafety(value: string): boolean {
  return !/\[\[unsafe\]\]|provider_secret|api[-_ ]?key|bearer\s+[a-z0-9._-]+/iu.test(value);
}
