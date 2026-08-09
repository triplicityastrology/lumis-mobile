import {
  DICE_SYNTHETIC_REGISTRY_VERSION,
  type DiceSyntheticClassification,
  type DiceSyntheticFixture,
  type DiceSyntheticLanguage,
  type DiceSyntheticRegistry
} from "./dice-synthetic-registry-v0-3.ts";
import { classifyDiceQuestionRequest } from "../../../packages/shared/src/config/dice-question-boundary.ts";

export const DICE_SYNTHETIC_GATEWAY_VERSION = "dice_synthetic_gateway_v0_3" as const;
export const DICE_SYNTHETIC_PROMPT_VERSION = "dice_v0_3_synthetic_prompt_2026_08_09" as const;
export const DICE_INTERPRETATION_RESPONSE_VERSION = "dice_interpretation_response_v0_3" as const;
export const DICE_AZURE_SERVER_ALIAS = "lumis-ai-chat-stg" as const;
export const DICE_AZURE_DEPLOYMENT_FAMILY = "gpt-5-mini" as const;
export const DICE_PROVIDER_DEADLINE_MS = 12_000 as const;

export const DICE_SYNTHETIC_CAPS = Object.freeze({
  logicalRequests: 120,
  providerAttempts: 240,
  languageRequests: Object.freeze({ en: 60, "zh-Hant": 60 }),
  maxInputTokens: 800,
  maxOutputTokens: 300,
  concurrency: 2,
  maxEligibleRetries: 1
});

export type DiceSyntheticRequest = Readonly<{ fixture_id: string }>;
export type DiceProviderResult =
  | Readonly<{ kind: "success"; output: unknown }>
  | Readonly<{ kind: "content_filter_block" | "content_filter_partial" }>
  | Readonly<{ kind: "timeout" | "network" | "rate_limited" | "server_error" }>
  | Readonly<{ kind: "authentication" | "permission" | "invalid_output" }>;

export interface DiceAzureAdapter {
  invoke(input: Readonly<{
    providerAlias: typeof DICE_AZURE_SERVER_ALIAS;
    promptVersion: typeof DICE_SYNTHETIC_PROMPT_VERSION;
    prompt: string;
    language: DiceSyntheticLanguage;
    deadlineAtMs: number;
    maxOutputTokens: 300;
  }>): Promise<DiceProviderResult>;
}

export type DiceInterpretationResponse = Readonly<{
  version: typeof DICE_INTERPRETATION_RESPONSE_VERSION;
  result: "completed" | "safety_redirect" | "fixed_fallback" | "rejected" | "technical_error";
  language: DiceSyntheticLanguage;
  code: string;
  reading?: string;
  watch_out?: string;
  practical_direction?: string;
  message?: string;
  effects: Readonly<{ persistence_writes: 0; units_charged: 0 }>;
}>;

export type DiceGatewayEvidence = Readonly<{
  fixture_id: string;
  language: DiceSyntheticLanguage | "unknown";
  result_class: DiceInterpretationResponse["result"];
  attempt_count: 0 | 1 | 2;
  duration_bucket: "pre_provider" | "under_12s" | "deadline";
  failure_code: string | null;
}>;

export type DiceGatewayRunResult = Readonly<{
  response: DiceInterpretationResponse;
  evidence: DiceGatewayEvidence;
}>;

type Clock = { now(): number };

export interface DiceSyntheticBudgetPort {
  beginLogical(language: DiceSyntheticLanguage): string | null;
  beginAttempt(): string | null;
  finishLogical(): void;
}

export class DiceSyntheticRunBudget implements DiceSyntheticBudgetPort {
  private logical = 0;
  private attempts = 0;
  private active = 0;
  private readonly languages: Record<DiceSyntheticLanguage, number> = { en: 0, "zh-Hant": 0 };

  beginLogical(language: DiceSyntheticLanguage): string | null {
    if (this.logical >= DICE_SYNTHETIC_CAPS.logicalRequests) return "DICE_CAP_LOGICAL_EXHAUSTED";
    if (this.languages[language] >= DICE_SYNTHETIC_CAPS.languageRequests[language]) return "DICE_CAP_LANGUAGE_EXHAUSTED";
    if (this.active >= DICE_SYNTHETIC_CAPS.concurrency) return "DICE_CAP_CONCURRENCY_EXHAUSTED";
    this.logical += 1;
    this.languages[language] += 1;
    this.active += 1;
    return null;
  }

  beginAttempt(): string | null {
    if (this.attempts >= DICE_SYNTHETIC_CAPS.providerAttempts) return "DICE_CAP_ATTEMPTS_EXHAUSTED";
    this.attempts += 1;
    return null;
  }

  finishLogical(): void {
    this.active = Math.max(0, this.active - 1);
  }

  snapshot(): Readonly<{ logical: number; attempts: number; active: number; en: number; zh_hant: number }> {
    return Object.freeze({
      logical: this.logical,
      attempts: this.attempts,
      active: this.active,
      en: this.languages.en,
      zh_hant: this.languages["zh-Hant"]
    });
  }
}

export class DiceSyntheticGateway {
  constructor(
    private readonly registry: DiceSyntheticRegistry,
    private readonly adapter: DiceAzureAdapter,
    private readonly budget: DiceSyntheticBudgetPort,
    private readonly clock: Clock = { now: () => Date.now() }
  ) {}

  async run(raw: unknown): Promise<DiceGatewayRunResult> {
    const fixtureId = parseClosedRequest(raw);
    if (!fixtureId) return preProvider("unknown", "DICE_SYNTHETIC_REQUEST_INVALID");
    const fixture = this.registry.getFixture(fixtureId);
    if (!fixture || this.registry.version !== DICE_SYNTHETIC_REGISTRY_VERSION) {
      return preProvider(fixtureId, "DICE_SYNTHETIC_FIXTURE_NOT_ALLOWED");
    }

    const authority = validateFixtureAuthority(fixture);
    if (!authority.ok) return preProvider(fixture.fixtureId, authority.code, fixture.language);
    if (authority.safety === "safety_redirect") {
      return safeResult(fixture, "safety_redirect", "DICE_SAFETY_REDIRECT", safetyMessage(fixture.language), 0, "pre_provider");
    }
    if (authority.safety === "excluded") {
      return safeResult(fixture, "rejected", "DICE_SCOPE_EXCLUDED", undefined, 0, "pre_provider");
    }

    const prompt = assemblePrompt(fixture, authority.classification);
    if (estimateTokens(prompt) > DICE_SYNTHETIC_CAPS.maxInputTokens) {
      return preProvider(fixture.fixtureId, "DICE_INPUT_TOKEN_CAP_EXCEEDED", fixture.language);
    }
    const capError = this.budget.beginLogical(fixture.language);
    if (capError) return preProvider(fixture.fixtureId, capError, fixture.language);

    const startedAt = this.clock.now();
    const deadlineAtMs = startedAt + DICE_PROVIDER_DEADLINE_MS;
    let attemptCount: 0 | 1 | 2 = 0;
    try {
      for (let attempt = 0; attempt <= DICE_SYNTHETIC_CAPS.maxEligibleRetries; attempt += 1) {
        if (this.clock.now() >= deadlineAtMs) {
          return safeResult(fixture, "fixed_fallback", "DICE_PROVIDER_DEADLINE", fallbackMessage(fixture.language), attemptCount, "deadline");
        }
        const attemptError = this.budget.beginAttempt();
        if (attemptError) return safeResult(fixture, "technical_error", attemptError, undefined, attemptCount, "under_12s");
        attemptCount = (attemptCount + 1) as 1 | 2;
        const provider = await this.adapter.invoke({
          providerAlias: DICE_AZURE_SERVER_ALIAS,
          promptVersion: DICE_SYNTHETIC_PROMPT_VERSION,
          prompt,
          language: fixture.language,
          deadlineAtMs,
          maxOutputTokens: DICE_SYNTHETIC_CAPS.maxOutputTokens
        });
        if (provider.kind === "content_filter_block" || provider.kind === "content_filter_partial") {
          return safeResult(fixture, "safety_redirect", "DICE_PROVIDER_SAFETY", safetyMessage(fixture.language), attemptCount, "under_12s");
        }
        if (provider.kind === "success") {
          const projected = projectProviderOutput(provider.output, fixture.language);
          if (projected) return completed(fixture, projected, attemptCount);
          return safeResult(fixture, "fixed_fallback", "DICE_PROVIDER_OUTPUT_INVALID", fallbackMessage(fixture.language), attemptCount, "under_12s");
        }
        if (!isRetryEligible(provider.kind) || attempt === DICE_SYNTHETIC_CAPS.maxEligibleRetries) {
          return safeResult(fixture, "fixed_fallback", providerFailureCode(provider.kind), fallbackMessage(fixture.language), attemptCount, "under_12s");
        }
      }
      return safeResult(fixture, "technical_error", "DICE_GATEWAY_UNREACHABLE", undefined, attemptCount, "under_12s");
    } finally {
      this.budget.finishLogical();
    }
  }
}

export function parseClosedRequest(raw: unknown): string | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ["fixture_id"]) || typeof raw.fixture_id !== "string") return null;
  return /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+){2,7}$/.test(raw.fixture_id) ? raw.fixture_id : null;
}

export function validateFixtureAuthority(fixture: DiceSyntheticFixture):
  | { ok: true; classification: DiceSyntheticClassification; safety: "ordinary" | "safety_redirect" | "excluded" }
  | { ok: false; code: string } {
  const decision = classifyDiceQuestionRequest({ question: fixture.question });
  const stoppedSafety = !decision.accepted && (
    decision.code === "DICE_QUESTION_SAFETY_ROUTE_REQUIRED"
    || decision.code === "DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED"
  ) ? "safety_redirect" : !decision.accepted && decision.code === "DICE_QUESTION_SCOPE_EXCLUDED" ? "excluded" : null;
  if (!decision.accepted && !stoppedSafety) return { ok: false, code: "DICE_FIXTURE_QUESTION_INVALID" };
  const language = decision.accepted ? decision.language : /[\u3400-\u9fff\uf900-\ufaff]/u.test(fixture.question) ? "zh-Hant" : "en";
  if (language !== fixture.language) return { ok: false, code: "DICE_FIXTURE_LANGUAGE_MISMATCH" };
  const safety = stoppedSafety ?? "ordinary";
  const classification: DiceSyntheticClassification = stoppedSafety
    ? fixture.expectedClassification
    : decision.accepted && decision.route === "judgment" ? "judgment" : "descriptive";
  if (safety !== fixture.expectedSafety || classification !== fixture.expectedClassification) {
    return { ok: false, code: "DICE_FIXTURE_AUTHORITY_MISMATCH" };
  }
  if (!/^[a-z0-9_]+$/u.test(fixture.outcome.planet) || !/^[a-z]+$/u.test(fixture.outcome.sign) || !/^house_(?:[1-9]|1[0-2])$/u.test(fixture.outcome.house)) {
    return { ok: false, code: "DICE_FIXTURE_OUTCOME_INVALID" };
  }
  return { ok: true, classification, safety };
}

function assemblePrompt(fixture: DiceSyntheticFixture, classification: DiceSyntheticClassification): string {
  return [
    `template=${DICE_SYNTHETIC_PROMPT_VERSION}`,
    `language=${fixture.language}`,
    `classification=${classification}`,
    `question=${fixture.question}`,
    `landed=${fixture.outcome.planet}|${fixture.outcome.sign}|${fixture.outcome.house}`,
    "Interpret only the supplied landed symbols. Never calculate or redraw them, and never use natal chart or birth data.",
    "Exclude Level 3 body-part material, multi-throw element patterns, Past Reflections linkage, sharing cards, Persona, Knowledge Bank, and history context.",
    "Return strict JSON fields reading, watch_out, practical_direction in the requested language. Avoid certainty."
  ].join("\n");
}

function projectProviderOutput(raw: unknown, language: DiceSyntheticLanguage): { reading: string; watch_out: string; practical_direction: string } | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ["reading", "watch_out", "practical_direction"])) return null;
  const fields = [raw.reading, raw.watch_out, raw.practical_direction];
  if (fields.some((value) => typeof value !== "string" || !value.trim() || estimateTokens(value) > 100)) return null;
  const combined = fields.join(" ");
  if (estimateTokens(combined) > DICE_SYNTHETIC_CAPS.maxOutputTokens) return null;
  const hasChinese = /[\u3400-\u9fff\uf900-\ufaff]/u.test(combined);
  if ((language === "en" && hasChinese) || (language === "zh-Hant" && !hasChinese)) return null;
  return { reading: String(raw.reading).trim(), watch_out: String(raw.watch_out).trim(), practical_direction: String(raw.practical_direction).trim() };
}

function completed(fixture: DiceSyntheticFixture, output: { reading: string; watch_out: string; practical_direction: string }, attempts: 1 | 2): DiceGatewayRunResult {
  return {
    response: { version: DICE_INTERPRETATION_RESPONSE_VERSION, result: "completed", language: fixture.language, code: "DICE_INTERPRETATION_READY", ...output, effects: zeroEffects() },
    evidence: evidence(fixture.fixtureId, fixture.language, "completed", attempts, "under_12s", null)
  };
}

function preProvider(fixtureId: string, code: string, language: DiceSyntheticLanguage | "unknown" = "unknown"): DiceGatewayRunResult {
  const responseLanguage = language === "unknown" ? "en" : language;
  return {
    response: { version: DICE_INTERPRETATION_RESPONSE_VERSION, result: "rejected", language: responseLanguage, code, effects: zeroEffects() },
    evidence: evidence(fixtureId, language, "rejected", 0, "pre_provider", code)
  };
}

function safeResult(fixture: DiceSyntheticFixture, result: DiceInterpretationResponse["result"], code: string, message: string | undefined, attempts: 0 | 1 | 2, duration: DiceGatewayEvidence["duration_bucket"]): DiceGatewayRunResult {
  return {
    response: { version: DICE_INTERPRETATION_RESPONSE_VERSION, result, language: fixture.language, code, ...(message ? { message } : {}), effects: zeroEffects() },
    evidence: evidence(fixture.fixtureId, fixture.language, result, attempts, duration, code)
  };
}

function evidence(fixtureId: string, language: DiceGatewayEvidence["language"], result: DiceInterpretationResponse["result"], attempts: 0 | 1 | 2, duration: DiceGatewayEvidence["duration_bucket"], failureCode: string | null): DiceGatewayEvidence {
  return Object.freeze({ fixture_id: fixtureId, language, result_class: result, attempt_count: attempts, duration_bucket: duration, failure_code: failureCode });
}

function zeroEffects(): DiceInterpretationResponse["effects"] {
  return Object.freeze({ persistence_writes: 0, units_charged: 0 });
}

function isRetryEligible(kind: DiceProviderResult["kind"]): boolean {
  return kind === "timeout" || kind === "network" || kind === "rate_limited" || kind === "server_error";
}

function providerFailureCode(kind: DiceProviderResult["kind"]): string {
  if (kind === "authentication") return "DICE_PROVIDER_AUTHENTICATION";
  if (kind === "permission") return "DICE_PROVIDER_PERMISSION";
  if (kind === "timeout") return "DICE_PROVIDER_TIMEOUT";
  if (kind === "rate_limited") return "DICE_PROVIDER_RATE_LIMITED";
  if (kind === "server_error") return "DICE_PROVIDER_SERVER_ERROR";
  if (kind === "network") return "DICE_PROVIDER_NETWORK";
  return "DICE_PROVIDER_OUTPUT_INVALID";
}

function fallbackMessage(language: DiceSyntheticLanguage): string {
  return language === "zh-Hant" ? "暫時未能完成這次骰子解讀，請稍後再試。" : "The Dice interpretation is temporarily unavailable. Please try again.";
}

function safetyMessage(language: DiceSyntheticLanguage): string {
  return language === "zh-Hant" ? "這個問題需要較安全或專業的支援，而不是一般骰子解讀。" : "This question needs safer or professional support rather than an ordinary Dice interpretation.";
}

function estimateTokens(value: string): number {
  return [...value].length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}
