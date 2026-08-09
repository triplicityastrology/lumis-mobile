import {
  DICE_INTERPRETATION_RESPONSE_VERSION,
  assembleDicePrompt,
  buildDiceRoutingEnvelopeForTest,
  projectDiceInterpretationResponse,
  type DiceInterpretationRequest,
  type DiceInterpretationResponse,
  type TrustedDiceRouteContext
} from "./dice-interpretation-v1";

export const DICE_OFFLINE_ENGINE_VERSION = "dice_offline_engine_v0.3_1" as const;
export const DICE_OFFLINE_PROVIDER_ENABLED = false as const;

export type StubProviderMode = "success" | "timeout" | "content_filter" | "malformed" | "unavailable";
export type OfflineDiceResult = {
  version: typeof DICE_OFFLINE_ENGINE_VERSION;
  status: "completed" | "fallback" | "safety_redirect" | "rejected";
  code: string;
  response?: DiceInterpretationResponse;
  message?: string;
  evidence: {
    provider_calls: number;
    persistence_writes: 0;
    units_consumed: 0;
    idempotency: "new" | "replay";
  };
};

type EngineInput = {
  idempotencyKey: string;
  request: DiceInterpretationRequest;
  trusted: TrustedDiceRouteContext;
};

type StubProvider = (input: { language: "en" | "zh-Hant"; mode: StubProviderMode }) => Promise<unknown>;

export class OfflineDiceInterpretationHarness {
  private readonly completed = new Map<string, OfflineDiceResult>();
  private readonly inFlight = new Map<string, Promise<OfflineDiceResult>>();
  private providerCalls = 0;

  constructor(private readonly provider: StubProvider = deterministicStubProvider) {}

  getProviderCallCount(): number {
    return this.providerCalls;
  }

  async run(raw: unknown, mode: StubProviderMode): Promise<OfflineDiceResult> {
    const parsed = parseEngineInput(raw);
    if (!parsed.ok) return rejected(parsed.code);
    const prior = this.completed.get(parsed.value.idempotencyKey);
    if (prior) return replay(prior);
    const running = this.inFlight.get(parsed.value.idempotencyKey);
    if (running) return replay(await running);

    const execution = this.execute(parsed.value, mode);
    this.inFlight.set(parsed.value.idempotencyKey, execution);
    try {
      const result = await execution;
      this.completed.set(parsed.value.idempotencyKey, result);
      return result;
    } finally {
      this.inFlight.delete(parsed.value.idempotencyKey);
    }
  }

  private async execute(input: EngineInput, mode: StubProviderMode): Promise<OfflineDiceResult> {
    const envelope = buildDiceRoutingEnvelopeForTest(input.request, input.trusted);
    if (!envelope.ok) {
      const safety = envelope.code === "DICE_INTERPRETATION_FIXED_TEMPLATE_REQUIRED";
      return {
        version: DICE_OFFLINE_ENGINE_VERSION,
        status: safety ? "safety_redirect" : "rejected",
        code: envelope.code,
        message: safety ? safetyMessage(input.trusted.appLanguage ?? "en") : undefined,
        evidence: effects(0, "new")
      };
    }

    const prompt = assembleDicePrompt(envelope.value);
    void prompt;
    const maxAttempts = mode === "timeout" || mode === "unavailable" ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.providerCalls += 1;
      const rawResponse = await this.provider({ language: envelope.value.language, mode });
      if (mode === "content_filter") {
        return {
          version: DICE_OFFLINE_ENGINE_VERSION,
          status: "safety_redirect",
          code: "DICE_PROVIDER_CONTENT_FILTERED",
          message: safetyMessage(envelope.value.language),
          evidence: effects(attempt, "new")
        };
      }
      if (mode === "timeout" || mode === "unavailable") continue;
      const projected = projectDiceInterpretationResponse(rawResponse, envelope.value.language);
      if (!projected.ok) return fallback(envelope.value.language, attempt, "DICE_PROVIDER_OUTPUT_INVALID");
      return {
        version: DICE_OFFLINE_ENGINE_VERSION,
        status: "completed",
        code: "DICE_INTERPRETATION_READY",
        response: projected.value,
        evidence: effects(attempt, "new")
      };
    }
    return fallback(envelope.value.language, maxAttempts, mode === "timeout" ? "DICE_PROVIDER_TIMEOUT" : "DICE_PROVIDER_UNAVAILABLE");
  }
}
function parseEngineInput(raw: unknown): { ok: true; value: EngineInput } | { ok: false; code: string } {
  if (!isRecord(raw) || !hasExactKeys(raw, ["idempotencyKey", "request", "trusted"])) return { ok: false, code: "DICE_ENGINE_INVALID_REQUEST" };
  if (typeof raw.idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(raw.idempotencyKey)) {
    return { ok: false, code: "DICE_ENGINE_INVALID_IDEMPOTENCY_KEY" };
  }
  if (!isRecord(raw.request) || !isRecord(raw.trusted)) return { ok: false, code: "DICE_ENGINE_INVALID_REQUEST" };
  if (!hasExactKeys(raw.trusted, ["questionShape", "safetyDisposition", "appLanguage"])) return { ok: false, code: "DICE_ENGINE_INVALID_REQUEST" };
  return { ok: true, value: raw as unknown as EngineInput };
}

async function deterministicStubProvider({ language, mode }: { language: "en" | "zh-Hant"; mode: StubProviderMode }): Promise<unknown> {
  await Promise.resolve();
  if (mode === "timeout" || mode === "unavailable" || mode === "content_filter") return null;
  if (mode === "malformed") return { untrusted: "invalid" };
  return language === "zh-Hant"
    ? { version: DICE_INTERPRETATION_RESPONSE_VERSION, language, reading: "這組合邀請你先看清眼前的動力。", watchOut: "不要把象徵當成確定答案。", practicalDirection: "先選一個可逆的小行動。" }
    : { version: DICE_INTERPRETATION_RESPONSE_VERSION, language, reading: "This combination invites you to notice the present momentum.", watchOut: "Do not treat symbolism as certainty.", practicalDirection: "Choose one reversible next step." };
}

function fallback(language: "en" | "zh-Hant", calls: number, code: string): OfflineDiceResult {
  return {
    version: DICE_OFFLINE_ENGINE_VERSION,
    status: "fallback",
    code,
    message: language === "zh-Hant" ? "暫時未能提供解讀。你的問題和骰子結果仍會留在畫面上。" : "The reading is temporarily unavailable. Your question and landed symbols remain on screen.",
    evidence: effects(calls, "new")
  };
}

function safetyMessage(language: "en" | "zh-Hant"): string {
  return language === "zh-Hant" ? "這個問題需要較安全的支援，而不是一般骰子解讀。" : "This request needs a safer support route rather than an ordinary Dice interpretation.";
}

function rejected(code: string): OfflineDiceResult {
  return { version: DICE_OFFLINE_ENGINE_VERSION, status: "rejected", code, evidence: effects(0, "new") };
}

function replay(result: OfflineDiceResult): OfflineDiceResult {
  return { ...result, evidence: { ...result.evidence, provider_calls: 0, idempotency: "replay" } };
}

function effects(provider_calls: number, idempotency: "new" | "replay"): OfflineDiceResult["evidence"] {
  return { provider_calls, persistence_writes: 0, units_consumed: 0, idempotency };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}
