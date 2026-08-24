/**
 * v4 two-stage free-text orchestration (Founder-approved 2026-08-24).
 *
 * Deterministic hard gates → Stage 1 (semantic mode selection) → Stage 2
 * (mode interpretation with least-data payload). One member Run makes at most
 * one mode-selection call plus a bounded interpretation call; no uncontrolled
 * retries. Evidence stays metadata-only.
 */
import { classifyDiceQuestionRequest, detectDiceQuestionLanguage } from "../../../packages/shared/src/config/dice-question-boundary.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";
import {
  buildDiceV04InterpretationPrompt,
  buildDiceV04ModeSelectionPrompt,
  parseDiceV04ModeSelection,
  parseDiceV04Output,
  type DiceV04Landing,
  type DiceV04Language,
  type DiceV04QuestionMode,
  type DiceV04Result,
} from "./dice-v0-4-interpretation-contract.ts";
import {
  createDiceV04Adapter,
  diceV04InterpretationJsonSchema,
  diceV04ModeSelectionJsonSchema,
  type DiceV04ProviderAdapter,
} from "./azure-dice-adapter-v4.ts";

const INPUT_CAP = 1600;
const MODE_OUTPUT_CAP = 300 as const;
const INTERPRETATION_OUTPUT_CAP = 600 as const;
const SHARED_DEADLINE_MS = 12000;
const PLANETS = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"]);
const SIGNS = new Set(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
const HOUSES = new Set(Array.from({ length: 12 }, (_, index) => `house_${index + 1}`));

export type DiceV04FreeTextRequest = Readonly<{ question: string; planet_id: string; sign_id: string; house_id: string }>;

export type DiceV04CaseOutcome =
  | Readonly<{ kind: "completed"; question_mode: DiceV04QuestionMode; result: DiceV04Result; provider_calls: number; metadata: DiceV04Metadata }>
  | Readonly<{ kind: "route_review" | "bundled" | "safety" | "fallback"; code: string; language: DiceV04Language; provider_calls: number; metadata: DiceV04Metadata }>;

export type DiceV04Metadata = Readonly<{
  request_mode: "founder_free_text";
  language: DiceV04Language;
  question_mode: DiceV04QuestionMode | null;
  result_class: string;
  provider_calls: number;
  latency_bucket: string;
  cost_bucket: string;
}>;

export function parseDiceV04FreeTextRequest(value: unknown): DiceV04FreeTextRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = ["question", "planet_id", "sign_id", "house_id"];
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || !keys.every((key) => key in record)) return null;
  if (keys.some((key) => typeof record[key] !== "string")) return null;
  if (!PLANETS.has(record.planet_id as string) || !SIGNS.has(record.sign_id as string) || !HOUSES.has(record.house_id as string)) return null;
  const question = (record.question as string).trim();
  if (!question || [...question].length > 280) return null;
  return Object.freeze({ ...(record as DiceV04FreeTextRequest), question });
}

function metadata(language: DiceV04Language, mode: DiceV04QuestionMode | null, resultClass: string, providerCalls: number): DiceV04Metadata {
  return Object.freeze({
    request_mode: "founder_free_text",
    language,
    question_mode: mode,
    result_class: resultClass,
    provider_calls: providerCalls,
    latency_bucket: providerCalls > 0 ? "lt_12s" : "zero",
    cost_bucket: providerCalls > 0 ? "within_cap" : "zero",
  });
}

function hardGateOutcome(code: string, language: DiceV04Language): DiceV04CaseOutcome {
  const kind = code.includes("SAFETY") || code.includes("PROFESSIONAL") || code.includes("EMERGENCY")
    ? "safety"
    : code.includes("BUNDLED") || code.includes("MULTIPLE") || code.includes("CHOICE")
    ? "bundled"
    : "route_review";
  return Object.freeze({ kind, code, language, provider_calls: 0, metadata: metadata(language, null, kind, 0) });
}

export async function executeDiceV04FreeTextCase(
  input: DiceV04FreeTextRequest,
  adapterSource: DiceV04ProviderAdapter | (() => DiceV04ProviderAdapter),
  now: () => number = () => Date.now(),
): Promise<DiceV04CaseOutcome> {
  // Deterministic hard gates only (bundled / safety / excluded / unclear).
  const decision = classifyDiceQuestionRequest({ question: input.question });
  const language: DiceV04Language = decision.accepted ? decision.language : detectDiceQuestionLanguage(input.question);
  if (!decision.accepted) return hardGateOutcome(decision.code, language);

  const landing: DiceV04Landing = { planet: input.planet_id, sign: input.sign_id, house: input.house_id };
  const adapter = typeof adapterSource === "function" ? adapterSource() : adapterSource;
  const deadline = now() + SHARED_DEADLINE_MS;
  let providerCalls = 0;

  // Stage 1: semantic mode selection.
  const modePrompt = buildDiceV04ModeSelectionPrompt(decision.normalized_question, language);
  if (!measureDiceTokenLimit(modePrompt, INPUT_CAP).within_limit) {
    return Object.freeze({ kind: "fallback", code: "DICE_INPUT_TOKEN_CAP", language, provider_calls: providerCalls, metadata: metadata(language, null, "fallback", providerCalls) });
  }
  const stage1 = await invokeStage(adapter, modePrompt, MODE_OUTPUT_CAP, "lumis_dice_mode_selection_v4", diceV04ModeSelectionJsonSchema(), deadline, now);
  providerCalls += 1;
  if (stage1.kind !== "success") {
    return providerFailure(stage1.kind, language, null, providerCalls);
  }
  const selection = parseDiceV04ModeSelection(stage1.content);
  if (!selection) return Object.freeze({ kind: "fallback", code: "DICE_MODE_SELECTION_INVALID", language, provider_calls: providerCalls, metadata: metadata(language, null, "fallback", providerCalls) });
  if (selection.kind === "route_review") {
    return Object.freeze({ kind: "route_review", code: "DICE_ROUTE_REVIEW_REQUIRED", language, provider_calls: providerCalls, metadata: metadata(language, null, "route_review", providerCalls) });
  }
  const mode = selection.mode;

  // Stage 2: mode interpretation, least-data payload, one eligible retry.
  const interpretationPrompt = buildDiceV04InterpretationPrompt(mode, decision.normalized_question, language, landing);
  if (!measureDiceTokenLimit(interpretationPrompt, INPUT_CAP).within_limit) {
    return Object.freeze({ kind: "fallback", code: "DICE_INPUT_TOKEN_CAP", language, provider_calls: providerCalls, metadata: metadata(language, mode, "fallback", providerCalls) });
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (now() >= deadline) return providerFailure("timeout", language, mode, providerCalls);
    const stage2 = await invokeStage(adapter, interpretationPrompt, INTERPRETATION_OUTPUT_CAP, "lumis_dice_interpretation_v4", diceV04InterpretationJsonSchema(mode, language), deadline, now);
    providerCalls += 1;
    if (stage2.kind === "success") {
      if (!measureDiceTokenLimit(stage2.content, INTERPRETATION_OUTPUT_CAP).within_limit) {
        return Object.freeze({ kind: "fallback", code: "DICE_OUTPUT_TOKEN_CAP", language, provider_calls: providerCalls, metadata: metadata(language, mode, "fallback", providerCalls) });
      }
      const output = parseDiceV04Output(stage2.content, { mode, language });
      if (!output) {
        if (attempt < 2 && now() < deadline) continue;
        return Object.freeze({ kind: "fallback", code: "DICE_PROVIDER_MALFORMED", language, provider_calls: providerCalls, metadata: metadata(language, mode, "fallback", providerCalls) });
      }
      if (output.kind === "route_review") {
        return Object.freeze({ kind: "route_review", code: "DICE_ROUTE_REVIEW_REQUIRED", language, provider_calls: providerCalls, metadata: metadata(language, mode, "route_review", providerCalls) });
      }
      return Object.freeze({ kind: "completed", question_mode: mode, result: output.result, provider_calls: providerCalls, metadata: metadata(language, mode, "completed", providerCalls) });
    }
    if (["authentication", "permission", "content_filter"].includes(stage2.kind) || attempt === 2 || now() >= deadline) {
      return providerFailure(stage2.kind, language, mode, providerCalls);
    }
  }
  return providerFailure("network", language, mode, providerCalls);
}

async function invokeStage(adapter: DiceV04ProviderAdapter, prompt: string, cap: 300 | 600, schemaName: string, schema: unknown, deadline: number, now: () => number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now()));
  try {
    return await adapter.invoke({ prompt, deadline_at_ms: deadline, max_output_tokens: cap, schema_name: schemaName, schema, signal: controller.signal }).catch(() => ({ kind: "network" as const }));
  } finally {
    clearTimeout(timer);
  }
}

function providerFailure(kind: string, language: DiceV04Language, mode: DiceV04QuestionMode | null, providerCalls: number): DiceV04CaseOutcome {
  const safety = kind === "content_filter";
  return Object.freeze({ kind: safety ? "safety" : "fallback", code: `DICE_${kind.toUpperCase()}`, language, provider_calls: providerCalls, metadata: metadata(language, mode, safety ? "safety" : "fallback", providerCalls) });
}

// Convenience factory binding the reviewed Azure config to a v4 adapter.
export function createDiceV04AdapterFactory(config: Parameters<typeof createDiceV04Adapter>[0], fetchImpl?: typeof fetch) {
  return () => createDiceV04Adapter(config, fetchImpl);
}
