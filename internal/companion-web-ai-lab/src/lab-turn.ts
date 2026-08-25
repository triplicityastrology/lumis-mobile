// Companion / Normal Chat Web AI Lab — turn orchestrator.
//
// Ties together: validate (pre-provider) -> deterministic plan -> provider (default-off)
// -> decision trace -> structured, disposable response (units_charged: 0, not_committed).
// Emits content-free telemetry only (AC-AI-01/02/03 DEC-03): no message content, no birth
// data, no names, no private text.

import {
  validateLabRequest,
  planLabTurn,
  internalRouteUnits,
  estimateTokens,
  type LabRequest,
  type LabPlan,
  type LabResponse,
  type DecisionTrace,
  type CanonicalState,
  type LabResultClass,
} from "./lab-engine.ts";
import { serializePersonaPrompt, assemblePersona } from "./lab-provider.ts";
import { retrieveNatalFacts, buildKnowledgeGrounding } from "./lab-knowledge-bank.ts";
import { templateForPublic } from "./lab-templates.ts";
import {
  LAB_RESPONSE_SCHEMA,
  MOBILE_CHAT_RESPONSE_SCHEMA,
  CHAT_SYNTHETIC_RESPONSE_SCHEMA,
  CHAT_SYNTHETIC_PROVIDER_ALIAS,
  CHAT_SYNTHETIC_SAFETY_PROFILE,
  CHAT_SYNTHETIC_FALLBACK,
  CHAT_SYNTHETIC_SAFETY_REDIRECT,
  CHAT_AZURE_APPROVED_HOSTNAME,
  CHAT_AZURE_DEPLOYMENT,
  CHAT_AZURE_MODEL,
  CHAT_AZURE_MODEL_VERSION,
  LAB_ROLES,
  type LabLanguage,
} from "./lab-constants.ts";
import { FIXED_TEMPLATE_REGISTRY_VERSION } from "../../../supabase/functions/_shared/fixed-template-registry.ts";
import { PERSONA_PROMPT_PIPELINE_VERSION } from "../../../supabase/functions/_shared/persona-prompt-pipeline-v1.ts";

// Failed-response continuity (Founder correction round #6). A turn that did not produce a real Lumis
// reply (temporary-unavailable / router-unavailable / technical error / content-filtered) must NOT be
// threaded into the rolling model history as if Lumis had successfully said it — otherwise a resend of
// the same message would be mistaken for an emotional repetition loop, and fallback text would pollute
// later context. The browser uses `contextEligibleTurn` to decide whether a turn enters the rolling
// context; failed turns are still displayed and persisted server-side for evidence, just not replayed.
export const CONTEXT_FAILURE_RESULTS = ["router_unavailable", "route_unavailable", "technical_error"] as const;
export const CONTEXT_FAILURE_DISPOSITIONS = ["content_filtered_input", "content_filtered_output", "http_or_schema_rejected"] as const;
export function contextEligibleTurn(result: string, providerDisposition: string | null | undefined): boolean {
  if ((CONTEXT_FAILURE_RESULTS as readonly string[]).includes(result)) return false;
  if (providerDisposition && (CONTEXT_FAILURE_DISPOSITIONS as readonly string[]).includes(providerDisposition)) return false;
  return true;
}

export type LabTelemetry = Readonly<{
  requestId: string;
  timestamp: string;
  baseRoute: string | null;
  canonicalState: string;
  result: string;
  language: string;
  providerAttempts: number;
  durationBucket: string;
  errorCode: string | null;
  templateId: string | null;
  aiEnabled: boolean;
}>;

// A live generative outcome, supplied ONLY by the authorized 12-case window runner. When absent,
// the turn is an offline routing preview and never contacts any provider (free-text safety).
export type LabGenerativeOutcome =
  | { kind: "completed"; message: string; attempts: 0 | 1 | 2 }
  | { kind: "safety_rejected"; attempts: 0 | 1 | 2; code: string }
  | { kind: "fixed_fallback"; attempts: 0 | 1 | 2; code: string }
  | { kind: "router_unavailable"; attempts: 0 | 1 | 2; code: string }
  | { kind: "technical_error"; attempts: 0 | 1 | 2; code: string };

export type LabTurnContext = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  nextRequestId?: () => string;
  recordTelemetry?: (t: LabTelemetry) => void;
  // Injected only by the authorized live-window runner; free-text callers never set this.
  liveProvider?: (args: { plan: LabPlan; request: LabRequest; language: LabLanguage }) => Promise<LabGenerativeOutcome>;
}>;

export type LabErrorResponse = {
  schema_version: typeof LAB_RESPONSE_SCHEMA;
  not_signed_off_customer_ui: true;
  canonical_state: "technical_error";
  result: "technical_error";
  error_code: string;
  detail: string;
  persistence: "not_committed";
  units_charged: 0;
  idempotency_outcome: "not_committed";
  provider_attempts: 0;
};

export type LabTurnResult = { status: number; body: LabResponse | LabErrorResponse };

function durationBucket(ms: number): DecisionTrace["latency"]["duration_bucket"] {
  return ms >= 12_000 ? "deadline" : ms >= 4000 ? "4_to_12s" : ms >= 1000 ? "1_to_4s" : "lt_1s";
}

export async function handleLabTurn(raw: unknown, ctx: LabTurnContext): Promise<LabTurnResult> {
  const nowMs = ctx.nowMs ?? Date.now;
  const nextRequestId = ctx.nextRequestId ?? (() => `lab-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`);
  const requestId = nextRequestId();
  const startedAt = nowMs();

  const validated = validateLabRequest(raw);
  if (!validated.ok) {
    // Malformed / unsupported input fails BEFORE any provider is contacted.
    emit(ctx, { requestId, timestamp: new Date(startedAt).toISOString(), baseRoute: null, canonicalState: "technical_error", result: "technical_error", language: "en", providerAttempts: 0, durationBucket: "lt_1s", errorCode: validated.error_code, templateId: null, aiEnabled: false });
    return {
      status: 400,
      body: {
        schema_version: LAB_RESPONSE_SCHEMA,
        not_signed_off_customer_ui: true,
        canonical_state: "technical_error",
        result: "technical_error",
        error_code: validated.error_code,
        detail: validated.detail,
        persistence: "not_committed",
        units_charged: 0,
        idempotency_outcome: "not_committed",
        provider_attempts: 0,
      },
    };
  }

  const request = validated.request;
  const plan = planLabTurn(request);

  // Provider is reachable ONLY through the authorized live-window runner (which injects
  // ctx.liveProvider). Free-text turns have no liveProvider and never contact any provider.
  const aiEnabled = Boolean(ctx.liveProvider);

  let canonicalState: CanonicalState = plan.canonicalState;
  let result: LabResultClass;
  let assistantMessage: string | null = null;
  let providerAttempts: 0 | 1 | 2 = 0;
  let errorCode: string | null = null;
  let fixedTemplate: LabResponse["fixed_template"] = null;
  let outputTokenEstimate: number | null = null;
  // Basic natal Knowledge Bank grounding (planet-in-sign only) for generative routes — controlled
  // Founder-approved bank content about the PERSON's own chart. Suppressed for non-generative routes.
  const kbRetrieval = plan.generative ? retrieveNatalFacts(request.chart) : { facts: [], suppressed: [] };
  const kbGrounding = buildKnowledgeGrounding(kbRetrieval);
  // Founder-internal assembly of the persona prompt (blocks + Character Voice Card) for generative
  // routes. Never shipped to the customer UI.
  const personaAssembly = (plan.generative && plan.personaPromptAssembled)
    ? assemblePersona(plan.personaPromptPayload, request.message, plan.language, request.context, plan.composition, kbGrounding, request.chart)
    : null;
  const generativePromptPreview: string | null = personaAssembly ? personaAssembly.prompt : null;

  if (!plan.generative) {
    // Deterministic (no provider) states.
    switch (plan.canonicalState) {
      case "chart_unavailable": {
        const tpl = templateForPublic("ROUTE_UNAVAILABLE", plan.language);
        result = "chart_unavailable";
        assistantMessage = tpl.text;
        errorCode = plan.composition.error_code ?? "customer_chart_unavailable";
        break;
      }
      case "crisis_imminent":
      case "distress_safety_check":
      case "illegal_boundary":
      case "professional_direct": {
        result = "safety_boundary";
        assistantMessage = plan.fixedTemplateText;
        fixedTemplate = { template_id: plan.fixedTemplateId!, family: plan.templateFamily!, status: plan.fixedTemplateStatus!, clinical_review_required: plan.fixedTemplateClinicalReview };
        break;
      }
      case "out_of_scope":
      case "out_of_scope_solar_return": {
        result = "out_of_scope_redirect";
        assistantMessage = plan.fixedTemplateText;
        fixedTemplate = { template_id: plan.fixedTemplateId!, family: plan.templateFamily!, status: plan.fixedTemplateStatus!, clinical_review_required: plan.fixedTemplateClinicalReview };
        break;
      }
      case "astro_timing_handoff": {
        result = "handoff_offer";
        assistantMessage = plan.language === "zh-Hant"
          ? "你想了解一個時間範圍（例如未來一週或一個月），還是比較特定日期（最多 3 個）？請先確認，我才會進行時機分析。"
          : "Would you like a timing window (e.g. the next week or month), or a specific-date comparison (up to 3 dates)? Please confirm before any timing analysis runs.";
        break;
      }
      default: {
        result = "technical_error";
        errorCode = "LAB_UNEXPECTED_STATE";
      }
    }
  } else if (!ctx.liveProvider) {
    // OFFLINE PREVIEW (free-text box): zero provider calls, always. Valid generative route, but
    // this path never contacts the provider -> route_unavailable with an offline-preview marker.
    canonicalState = "route_unavailable";
    const tpl = templateForPublic("ROUTE_UNAVAILABLE", plan.language);
    result = "route_unavailable";
    assistantMessage = tpl.text;
    errorCode = "COMPANION_WEB_AI_LAB_OFFLINE_PREVIEW";
    providerAttempts = 0;
  } else {
    // LIVE (authorized 12-case window only): the window runner supplies the generative outcome.
    const outcome = await ctx.liveProvider({ plan, request, language: plan.language });
    providerAttempts = outcome.attempts;
    switch (outcome.kind) {
      case "completed":
        result = "completed";
        assistantMessage = outcome.message;
        outputTokenEstimate = estimateTokens(outcome.message);
        break;
      case "safety_rejected":
        // A provider-side content/jailbreak shield hit (LAB_CONTENT_FILTER) on a route the
        // DETERMINISTIC router already cleared as safe is a false positive on Lumis's own persona
        // scaffolding — not the member asking for something unsafe. Report it honestly as a
        // transient provider issue ("temporarily unavailable"), never the misleading "can't help
        // with that request" redirect. Genuine post-safety failures (LAB_POST_SAFETY) and the
        // regression path keep the safety boundary.
        if (outcome.code === "LAB_CONTENT_FILTER" && plan.generative) {
          canonicalState = "router_unavailable";
          result = "router_unavailable";
          assistantMessage = templateForPublic("ROUTER_UNAVAILABLE", plan.language).text;
          errorCode = "LAB_PROVIDER_CONTENT_FILTER_SAFE_ROUTE";
        } else {
          result = "safety_boundary";
          assistantMessage = CHAT_SYNTHETIC_SAFETY_REDIRECT;
          errorCode = outcome.code;
        }
        break;
      case "fixed_fallback":
        result = "fixed_fallback";
        assistantMessage = CHAT_SYNTHETIC_FALLBACK;
        errorCode = outcome.code;
        break;
      case "router_unavailable": {
        canonicalState = "router_unavailable";
        const tpl = templateForPublic("ROUTER_UNAVAILABLE", plan.language);
        result = "router_unavailable";
        assistantMessage = tpl.text;
        errorCode = outcome.code;
        break;
      }
      case "technical_error":
      default:
        canonicalState = "technical_error";
        result = "technical_error";
        errorCode = outcome.code;
    }
  }

  const totalMs = Math.max(0, nowMs() - startedAt);
  const bucket = durationBucket(totalMs);
  const units = internalRouteUnits(canonicalState);
  const roleMeta = LAB_ROLES.find((x) => x.code === request.role_code)!;

  const trace: DecisionTrace = {
    selected_role: { code: request.role_code, current_label: roleMeta.currentLabel, internal_name: roleMeta.internalName },
    chart_composition_summary: plan.composition.available
      ? [`ASC(fixed): ${plan.composition.fixed_asc.sign}`, ...plan.composition.factors.filter((f) => f.factor !== "ASC").map((f) => `${f.factor}: ${f.sign} — ${f.note}`)]
      : [`chart unavailable: ${plan.composition.error_code}`],
    detected_language: plan.language,
    language_source: plan.languageSource,
    request_text_language: plan.requestTextLanguage,
    deterministic_classification: { base_route: plan.baseRoute, canonical_state: canonicalState, template_family: plan.templateFamily },
    safe_to_proceed: safeToProceed(canonicalState),
    crisis_safety_result: {
      triggered: canonicalState === "crisis_imminent" || canonicalState === "distress_safety_check",
      level: canonicalState === "crisis_imminent" ? "crisis_imminent" : canonicalState === "distress_safety_check" ? "distress_safety_check" : null,
      clinical_review_required: canonicalState === "crisis_imminent" || canonicalState === "distress_safety_check",
    },
    out_of_scope_result: { triggered: plan.outOfScopeKind !== null, kind: plan.outOfScopeKind },
    routing_handoff: plan.handoff
      ? { kind: plan.handoff.kind, requires_explicit_confirmation: true, note: plan.handoff.note }
      : { kind: "none", requires_explicit_confirmation: false, note: "No timing/Dice handoff." },
    knowledge_bank: knowledgeBankNote(canonicalState),
    prompt_system_version: {
      fixed_template_registry: FIXED_TEMPLATE_REGISTRY_VERSION,
      persona_prompt_pipeline: PERSONA_PROMPT_PIPELINE_VERSION,
      persona_rule: plan.composition.rule_versions.persona,
      persona_mapping: plan.composition.rule_versions.mapping,
      generative_prompt_assembled: plan.personaPromptAssembled,
    },
    response_result_class: result,
    model_identity: {
      provider_alias: CHAT_SYNTHETIC_PROVIDER_ALIAS,
      deployment: CHAT_AZURE_DEPLOYMENT,
      model: CHAT_AZURE_MODEL,
      model_version: CHAT_AZURE_MODEL_VERSION,
      hostname: CHAT_AZURE_APPROVED_HOSTNAME,
      safety_profile: CHAT_SYNTHETIC_SAFETY_PROFILE,
      ai_enabled: aiEnabled,
    },
    latency: { total_ms: totalMs, duration_bucket: bucket },
    usage_metadata: {
      internal_route_units: units.units,
      internal_units_note: units.note,
      prompt_token_estimate: estimateTokens(plan.generative ? serializePersonaPromptSafe(plan, request) : (assistantMessage ?? "")),
      output_token_estimate: outputTokenEstimate,
      customer_cost_display: "suppressed_by_preview_hold",
    },
    provider_attempts: providerAttempts,
    no_hidden_chain_of_thought: true,
  };

  const body: LabResponse = {
    schema_version: LAB_RESPONSE_SCHEMA,
    not_signed_off_customer_ui: true,
    canonical_state: canonicalState,
    result,
    language: plan.language,
    assistant_message: assistantMessage,
    fixed_template: fixedTemplate,
    handoff: plan.handoff,
    generative_prompt_preview: generativePromptPreview,
    error_code: errorCode,
    persistence: "not_committed",
    units_charged: 0,
    idempotency_outcome: "not_committed",
    provider_attempts: providerAttempts,
    chart_composition: plan.composition,
    knowledge_bank: { facts: kbRetrieval.facts, suppressed: kbRetrieval.suppressed },
    persona_blocks: personaAssembly ? personaAssembly.blocks : null,
    voice_card: personaAssembly ? personaAssembly.voice_card : null,
    decision_trace: trace,
    mobile_contract_alignment: {
      mobile_response_schema: MOBILE_CHAT_RESPONSE_SCHEMA,
      synthetic_response_schema: CHAT_SYNTHETIC_RESPONSE_SCHEMA,
      note: "Disposable internal Lab: mirrors the mobile normal_chat result-class mapping (completed/fixed_fallback/safety/technical) with the synthetic no-persistence contract (units_charged: 0, persistence: not_committed).",
    },
  };

  emit(ctx, {
    requestId, timestamp: new Date(startedAt).toISOString(),
    baseRoute: plan.baseRoute, canonicalState, result, language: plan.language,
    providerAttempts, durationBucket: bucket, errorCode, templateId: fixedTemplate?.template_id ?? plan.fixedTemplateId ?? null, aiEnabled,
  });

  return { status: 200, body };
}

function serializePersonaPromptSafe(plan: LabPlan, request: LabRequest): string {
  const kb = plan.generative ? buildKnowledgeGrounding(retrieveNatalFacts(request.chart)) : null;
  return serializePersonaPrompt(plan.personaPromptPayload, request.message, plan.language as LabLanguage, request.context, plan.composition, kb, request.chart);
}

function safeToProceed(state: CanonicalState): DecisionTrace["safe_to_proceed"] {
  switch (state) {
    case "crisis_imminent": case "distress_safety_check": case "illegal_boundary":
      return { value: false, reason: "Safety route: fixed safety copy only; no astrology/normal generation." };
    case "professional_direct":
      return { value: false, reason: "Professional boundary: fixed referral only; no diagnosis/advice/guarantee." };
    case "out_of_scope": case "out_of_scope_solar_return":
      return { value: false, reason: "Out of scope: scripted redirect only; no second open-ended generation." };
    case "chart_unavailable":
      return { value: false, reason: "Chart invalid/incomplete (Mercury required): stop persona generation." };
    case "route_unavailable":
      return { value: false, reason: "Provider disabled (default-off): valid route but internal availability off; 0 provider calls." };
    case "router_unavailable":
      return { value: false, reason: "Provider failure after one retry: fixed router-unavailable copy; 0 units." };
    case "astro_timing_handoff":
      return { value: false, reason: "Timing requires explicit confirmation before analysis (never silently upgraded)." };
    default:
      return { value: true, reason: "Normal route: safe to proceed to persona generation." };
  }
}

function knowledgeBankNote(state: CanonicalState): DecisionTrace["knowledge_bank"] {
  if (state === "knowledge" || state === "astro_deep") {
    return { in_scope: true, note: "Natal-chart interpretation only (KB-SCOPE-01). Transit/timing separately gated; Solar Return excluded." };
  }
  if (state === "out_of_scope_solar_return") {
    return { in_scope: false, note: "Solar Return is excluded from the Knowledge Bank entirely (KB-SCOPE-01)." };
  }
  return { in_scope: false, note: "Not a Knowledge Bank retrieval route." };
}

function emit(ctx: LabTurnContext, t: LabTelemetry) {
  // Content-free by construction: never includes message text, chart signs, names, or private text.
  if (ctx.recordTelemetry) ctx.recordTelemetry(t);
}
