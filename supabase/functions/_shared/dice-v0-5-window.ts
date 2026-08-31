/**
 * v5 two-stage orchestration (technical identity for "Dice AI Interpretation
 * Prompt v3"). Deterministic Stage-0 hard gates → Stage-1 semantic mode select
 * → Stage-2 least-data per-mode interpretation → system assembler. The provider
 * adapter is injected (testable). Landing identity is system-controlled and
 * validated before every Stage-2 call (§12.0). Evidence stays metadata-only:
 * no raw question or provider response leaves this module.
 * Source of truth: DICE_PROMPT_V3_TECHNICAL_PROPOSAL_REV4_2_FINAL.md (§10–§19).
 */
import { detectDiceQuestionLanguage } from "../../../packages/shared/src/config/dice-question-boundary.ts";
import { classifyDiceV05QuestionRequest } from "./dice-v0-5-question-gate.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";
import {
  DICE_V05_PLANET_IDS, DICE_V05_SIGN_IDS, dignityOf,
  type DiceV05Language, type DiceV05PlanetId, type DiceV05SignId,
} from "./dice-v0-5-fixed-data.ts";
import {
  DICE_V05_BLOCK, buildProviderInput, buildStage2Schema, diceV05Stage1Schema,
  parseDiceV05Stage1, parseDiceV05Stage2, validateLocation, validateLandingIdentity,
  validateDiceV05FinalResult, buildLanding, stage2ModeOf, nodeDignityOk,
  type DiceV05Mode, type DiceV05Stage2Mode,
} from "./dice-v0-5-interpretation-contract.ts";
import {
  buildJudgmentEnvelope, buildTimingEnvelope, buildLevel1Envelope, buildLocationResolution,
  assembleJudgment, assembleTiming, assembleLevel1, assembleLocation, assembleRouteReview,
} from "./dice-v0-5-presentation.ts";

const INPUT_CAP = 1600;
// Location Stage-2 carries the complete Planet + House + Element banks plus a full-length (280
// code-point) question, so its input is materially larger than the other modes. Its cap is 1800
// (all other mode inputs stay at 1600); the Location OUTPUT cap remains 580 by construction.
const LOCATION_INPUT_CAP = 1800;
const MODE_OUTPUT_CAP = 300 as const;
const OUTPUT_CAP = 600 as const;
// Location output backstop. Stable SEMANTIC evidence ids (reviewer item 3) enlarge the
// keys the model echoes, so the schema-permitted pathological maximum (4 candidates each
// citing 2 long keys in all three arrays + every field at its char cap) is ~658 zh tokens
// (was ~557 with positional keys). The backstop is raised 580→700 so no schema-valid answer
// is ever token-rejected; realistic answers are ~300–534. Per-field character caps remain
// the primary bound; this token cap is the secondary abuse backstop.
// Founder Decision B: Location is <= 580 tokens by construction. The SAME 580 is the provider
// max_output_tokens, the runtime output measurement limit, and the rejection backstop — the
// request is never issued with a different cap than the one we validate against.
const LOCATION_OUTPUT_CAP = 580 as const;
const SHARED_DEADLINE_MS = 12000;
const PLANETS = new Set<string>(DICE_V05_PLANET_IDS);
const SIGNS = new Set<string>(DICE_V05_SIGN_IDS);
const HOUSES = new Set(Array.from({ length: 12 }, (_, i) => `house_${i + 1}`));

export type DiceV05FreeTextRequest = Readonly<{ question: string; planet_id: string; sign_id: string; house_id: string }>;

export type DiceV05Metadata = Readonly<{
  request_mode: "founder_free_text";
  language: DiceV05Language;
  question_mode: DiceV05Mode | null;
  result_class: string;
  provider_calls: number;
  latency_bucket: string;
  cost_bucket: string;
  units_consumed: 0;
  persistence_writes: 0;
}>;

export type DiceV05CaseOutcome =
  | Readonly<{ kind: "completed"; question_mode: DiceV05Mode; result: Record<string, unknown>; provider_calls: number; metadata: DiceV05Metadata }>
  | Readonly<{ kind: "route_review" | "bundled" | "safety" | "fallback"; code: string; language: DiceV05Language; provider_calls: number; metadata: DiceV05Metadata }>;

export type DiceV05ProviderResult =
  | Readonly<{ kind: "success"; content: string }>
  | Readonly<{ kind: "network" | "timeout" | "authentication" | "permission" | "content_filter" | "server" | "malformed" }>;
export type DiceV05ProviderAdapter = Readonly<{
  invoke(request: Readonly<{ prompt: string; deadline_at_ms: number; max_output_tokens: number; schema_name: string; schema: unknown; signal: AbortSignal }>): Promise<DiceV05ProviderResult>;
}>;

export function parseDiceV05FreeTextRequest(value: unknown): DiceV05FreeTextRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const keys = ["question", "planet_id", "sign_id", "house_id"];
  if (Object.keys(rec).length !== keys.length || !keys.every((k) => k in rec)) return null;
  if (keys.some((k) => typeof rec[k] !== "string")) return null;
  if (!PLANETS.has(rec.planet_id as string) || !SIGNS.has(rec.sign_id as string) || !HOUSES.has(rec.house_id as string)) return null;
  const question = (rec.question as string).trim();
  if (!question || [...question].length > 280) return null;
  return Object.freeze({ question, planet_id: rec.planet_id as string, sign_id: rec.sign_id as string, house_id: rec.house_id as string });
}

function metadata(language: DiceV05Language, mode: DiceV05Mode | null, resultClass: string, providerCalls: number): DiceV05Metadata {
  return Object.freeze({
    request_mode: "founder_free_text", language, question_mode: mode, result_class: resultClass,
    provider_calls: providerCalls, latency_bucket: providerCalls > 0 ? "lt_12s" : "zero",
    cost_bucket: providerCalls > 0 ? "within_cap" : "zero", units_consumed: 0, persistence_writes: 0,
  });
}
function hardGateOutcome(code: string, language: DiceV05Language): DiceV05CaseOutcome {
  const kind = code.includes("SAFETY") || code.includes("PROFESSIONAL") || code.includes("EMERGENCY")
    ? "safety" : code.includes("BUNDLED") || code.includes("MULTIPLE") || code.includes("CHOICE") ? "bundled" : "route_review";
  return Object.freeze({ kind, code, language, provider_calls: 0, metadata: metadata(language, null, kind, 0) });
}
function fallback(code: string, language: DiceV05Language, mode: DiceV05Mode | null, calls: number): DiceV05CaseOutcome {
  return Object.freeze({ kind: "fallback", code, language, provider_calls: calls, metadata: metadata(language, mode, "fallback", calls) });
}
function routeReview(language: DiceV05Language, mode: DiceV05Mode | null, calls: number): DiceV05CaseOutcome {
  return Object.freeze({ kind: "route_review", code: "DICE_ROUTE_REVIEW_REQUIRED", language, provider_calls: calls, metadata: metadata(language, mode, "route_review", calls) });
}

function stage2SchemaName(mode: DiceV05Stage2Mode): string {
  return mode === "judgment" ? "lumis_dice_judgment_v5_stage2"
    : mode === "timing" ? "lumis_dice_timing_v5_stage2"
    : mode === "location" ? "lumis_dice_location_v5_stage2" : "lumis_dice_level1_v5_stage2";
}

export async function executeDiceV05FreeTextCase(
  input: DiceV05FreeTextRequest,
  adapterSource: DiceV05ProviderAdapter | (() => DiceV05ProviderAdapter),
  now: () => number = () => Date.now(),
): Promise<DiceV05CaseOutcome> {
  const decision = classifyDiceV05QuestionRequest({ question: input.question });
  const language: DiceV05Language = decision.accepted ? decision.language : detectDiceQuestionLanguage(input.question);
  if (!decision.accepted) return hardGateOutcome(decision.code, language);

  const planet = input.planet_id as DiceV05PlanetId;
  const sign = input.sign_id as DiceV05SignId;
  const house = Number(input.house_id.slice("house_".length));

  // §12.0 system-controlled landing identity, validated against the physical throw
  // before any Stage-2 call (DICE_LANDING_VALUE_MISMATCH, zero Stage-2 calls).
  const landing = buildLanding(planet, sign, house);
  if (!validateLandingIdentity(landing, { planet, sign, house })) return fallback("DICE_LANDING_VALUE_MISMATCH", language, null, 0);

  const adapter = typeof adapterSource === "function" ? adapterSource() : adapterSource;
  const deadline = now() + SHARED_DEADLINE_MS;
  let calls = 0;

  // Stage 1 — semantic mode selection.
  const stage1Input = buildProviderInput(DICE_V05_BLOCK.stage1, { language, question: decision.normalized_question });
  if (!measureDiceTokenLimit(stage1Input, INPUT_CAP).within_limit) return fallback("DICE_INPUT_TOKEN_CAP", language, null, calls);
  const s1 = await invokeStage(adapter, stage1Input, MODE_OUTPUT_CAP, "lumis_dice_mode_selection_v5", diceV05Stage1Schema(), deadline, now);
  calls += 1;
  if (s1.kind !== "success") return providerFailure(s1.kind, language, null, calls);
  const sel = parseDiceV05Stage1(s1.content);
  if (!sel) return fallback("DICE_MODE_SELECTION_INVALID", language, null, calls);
  if (sel.kind === "route_review") return routeReview(language, null, calls);
  const mode = sel.mode;
  const s2mode = stage2ModeOf(mode);

  // Timing/Judgment/Level-1 Node-dignity invariant (§14; SC-24, zero further calls).
  if ((s2mode === "timing" || s2mode === "judgment" || s2mode === "level1")) {
    const d = dignityOf(planet, sign);
    if (!nodeDignityOk(planet, d.dignity, d.dignity_zh, d.strength)) return fallback("DICE_NODE_DIGNITY_INVALID", language, mode, calls);
  }

  // Stage 2 — least-data per-mode interpretation.
  const q = decision.normalized_question;
  let stage2Input: string;
  let locationResolution: ReturnType<typeof buildLocationResolution> | null = null;
  if (s2mode === "judgment") stage2Input = buildProviderInput(DICE_V05_BLOCK.judgment, buildJudgmentEnvelope(language, q, planet, sign, house));
  else if (s2mode === "timing") stage2Input = buildProviderInput(DICE_V05_BLOCK.timing, buildTimingEnvelope(language, q, planet, sign, house));
  else if (s2mode === "location") { locationResolution = buildLocationResolution(language, planet, sign, house); stage2Input = buildProviderInput(DICE_V05_BLOCK.location, { ...locationResolution.envelope, question: q }); }
  else stage2Input = buildProviderInput(DICE_V05_BLOCK.level1, buildLevel1Envelope(mode as "person" | "reason" | "thing_or_situation", language, q, planet, sign, house));

  const inCap = s2mode === "location" ? LOCATION_INPUT_CAP : INPUT_CAP;
  if (!measureDiceTokenLimit(stage2Input, inCap).within_limit) return fallback("DICE_INPUT_TOKEN_CAP", language, mode, calls);
  const outCap = s2mode === "location" ? LOCATION_OUTPUT_CAP : OUTPUT_CAP;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (now() >= deadline) return providerFailure("timeout", language, mode, calls);
    const s2 = await invokeStage(adapter, stage2Input, outCap, stage2SchemaName(s2mode), buildStage2Schema(s2mode, language), deadline, now);
    calls += 1;
    if (s2.kind !== "success") {
      if (["authentication", "permission", "content_filter"].includes(s2.kind) || attempt === 2 || now() >= deadline) return providerFailure(s2.kind, language, mode, calls);
      continue;
    }
    if (!measureDiceTokenLimit(s2.content, outCap).within_limit) return fallback("DICE_OUTPUT_TOKEN_CAP", language, mode, calls);
    const parsed = parseDiceV05Stage2(s2mode, language, s2.content);
    if (!parsed) { if (attempt < 2 && now() < deadline) continue; return fallback("DICE_PROVIDER_MALFORMED", language, mode, calls); }
    if (parsed.kind === "route_review") return routeReview(language, mode, calls);

    let result: Record<string, unknown>;
    if (s2mode === "judgment") result = assembleJudgment(language, landing, parsed.value);
    else if (s2mode === "timing") result = assembleTiming(language, landing, parsed.value);
    else if (s2mode === "location") {
      const check = validateLocation(parsed.value as any, locationResolution!.selectedKeys);
      if (check !== "OK") { if (attempt < 2 && now() < deadline) continue; return fallback(check, language, mode, calls); }
      result = assembleLocation(language, parsed.value, locationResolution!.gid);
    } else result = assembleLevel1(language, mode as "person" | "reason" | "thing_or_situation", parsed.value);
    // Defense-in-depth: the assembled object must satisfy the complete §12.4 final schema
    // (shape + per-mode presence). A regression here fails closed rather than emitting a bad card.
    const finalCheck = validateDiceV05FinalResult(result);
    if (finalCheck !== "OK") return fallback("DICE_FINAL_ASSEMBLY_INVALID", language, mode, calls);
    return Object.freeze({ kind: "completed", question_mode: mode, result, provider_calls: calls, metadata: metadata(language, mode, "completed", calls) });
  }
  return providerFailure("network", language, mode, calls);
}

async function invokeStage(adapter: DiceV05ProviderAdapter, prompt: string, cap: number, schemaName: string, schema: unknown, deadline: number, now: () => number): Promise<DiceV05ProviderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now()));
  try {
    return await adapter.invoke({ prompt, deadline_at_ms: deadline, max_output_tokens: cap, schema_name: schemaName, schema, signal: controller.signal }).catch(() => ({ kind: "network" as const }));
  } finally {
    clearTimeout(timer);
  }
}
function providerFailure(kind: string, language: DiceV05Language, mode: DiceV05Mode | null, calls: number): DiceV05CaseOutcome {
  const safety = kind === "content_filter";
  return Object.freeze({ kind: safety ? "safety" : "fallback", code: `DICE_${kind.toUpperCase()}`, language, provider_calls: calls, metadata: metadata(language, mode, safety ? "safety" : "fallback", calls) });
}

// Assemble a route-review presentation object for a route_review outcome (§12.5).
export function diceV05RouteReviewResult(language: DiceV05Language, mode: DiceV05Mode): Record<string, unknown> {
  return assembleRouteReview(language, mode);
}

export { assembleRouteReview };
