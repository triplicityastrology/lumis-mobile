// Companion / Normal Chat Web AI Lab — deterministic engine.
//
// INTERNAL AI-TESTING INTERFACE ONLY — not the signed-off customer Chat UI.
//
// This module performs every DETERMINISTIC step of a Lab turn, reusing the reviewed T350
// Normal Chat candidate modules. It never calls a provider; the generative call (default-off)
// is executed separately by lab-provider.ts. Splitting the two guarantees that the routing,
// persona composition, template selection and decision trace are fully computed before any
// provider is contacted, and that malformed input fails here (pre-provider).
//
// Reused authority modules:
//   packages/shared/src/config/chat-router.ts        (classifyChatRoute, decisions, solar-return, safety)
//   packages/shared/src/config/routes.ts             (ROUTE_CREDITS / internal units)
//   packages/shared/src/config/app-language.ts       (language resolution rule, AC-AI-00 §1)
//   packages/shared/src/config/persona-calculator.ts (Chart Composition, workbook v1.2)
//   supabase/functions/_shared/persona-prompt-pipeline-v1.ts (reviewed persona prompt)
//   supabase/functions/_shared/fixed-template-registry.ts    (byte-exact fixed wording v0.2)

import {
  classifyChatRoute,
  getChatRouteDecision,
  isSolarReturnRequest,
} from "../../../packages/shared/src/config/chat-router.ts";
import type { ChatRoute } from "../../../packages/shared/src/config/routes.ts";
import {
  detectRequestLanguage,
  isAppLanguagePreference,
  resolveFixedTemplateLanguage,
  type AppLanguagePreference,
} from "../../../packages/shared/src/config/app-language.ts";
import {
  calculatePersonaProfile,
  type CustomerMoonInput,
} from "../../../packages/shared/src/config/persona-calculator.ts";
import {
  runPersonaPromptPipeline,
  PERSONA_PROMPT_PIPELINE_VERSION,
} from "../../../supabase/functions/_shared/persona-prompt-pipeline-v1.ts";
import {
  createFixedTemplateServerLoader,
  FIXED_TEMPLATE_REGISTRY_VERSION,
  type FixedTemplateFamilyId,
  type FixedTemplateLanguage,
} from "../../../supabase/functions/_shared/fixed-template-registry.ts";

import {
  LAB_REQUEST_SCHEMA,
  LAB_RESPONSE_SCHEMA,
  MOBILE_CHAT_RESPONSE_SCHEMA,
  CHAT_SYNTHETIC_RESPONSE_SCHEMA,
  LAB_ROLES,
  LAB_ROLE_CODES,
  isSignNumber,
  signName,
  type LabRoleCode,
  type LabLanguage,
} from "./lab-constants.ts";
import { labSafetyClassify, type LabSafetyLevel } from "./lab-safety.ts";

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

export type LabChartInput = {
  sun: number;
  moon: number;
  mercury: number;
  saturn: number;
  moon_confirmed: boolean;
};

// One prior turn of the browser-held rolling conversation context (never persisted server-side).
export type ConversationTurn = { role: "user" | "assistant"; text: string };
export const MAX_CONTEXT_TURNS = 12;
const MAX_CONTEXT_TURN_LEN = 1200;

export type LabRequest = {
  schema_version: typeof LAB_REQUEST_SCHEMA;
  role_code: LabRoleCode;
  chart: LabChartInput;
  message: string;
  app_language_preference: AppLanguagePreference | null;
  context: ConversationTurn[];
};

export type CanonicalState =
  | "chart_unavailable"
  | "crisis_imminent"
  | "distress_safety_check"
  | "illegal_boundary"
  | "professional_direct"
  | "out_of_scope_solar_return"
  | "out_of_scope"
  | "astro_timing_handoff"
  | "dice_handoff"
  | "knowledge"
  | "astro_deep"
  | "casual"
  | "route_unavailable"
  | "router_unavailable"
  | "technical_error";

// Mobile-contract-aligned result classes (normal_chat_mobile_response_v1 vocabulary),
// plus the AC-AI-00 §2 distinct redirect/handoff states that must not reuse "unavailable".
export type LabResultClass =
  | "completed"
  | "fixed_template"
  | "safety_boundary"
  | "out_of_scope_redirect"
  | "handoff_offer"
  | "fixed_fallback"
  | "route_unavailable"
  | "router_unavailable"
  | "chart_unavailable"
  | "technical_error";

export type ResolvedFactorView = {
  factor: "ASC" | "Sun" | "Moon" | "Mercury" | "Saturn";
  sign: string;
  signNumber: number;
  source: string;
  offset: number;
  note: string;
};

export type ChartComposition = {
  role: { code: LabRoleCode; current_label: string; internal_name: string };
  available: boolean;
  error_code?: string;
  fixed_asc: { sign: string; note: string };
  factors: ResolvedFactorView[];
  provided_placements: Array<{ placement: "Sun" | "Moon" | "Mercury" | "Saturn"; sign: string; consumed: boolean; note: string }>;
  moon_status: "confirmed_birth_time" | "unconfirmed";
  source_rules_applied: string[];
  rule_versions: { persona: string; mapping: string };
  no_invented_data: true;
};

export type DecisionTrace = {
  selected_role: { code: LabRoleCode; current_label: string; internal_name: string };
  chart_composition_summary: string[];
  detected_language: LabLanguage;
  language_source: "saved_app_language_preference" | "request_text_detection";
  request_text_language: LabLanguage;
  deterministic_classification: { base_route: ChatRoute; canonical_state: CanonicalState; template_family: FixedTemplateFamilyId | null };
  safe_to_proceed: { value: boolean; reason: string };
  crisis_safety_result: { triggered: boolean; level: Exclude<LabSafetyLevel, null> | null; clinical_review_required: boolean };
  out_of_scope_result: { triggered: boolean; kind: "general" | "solar_return" | "professional_direct" | "illegal" | null };
  routing_handoff: { kind: "none" | "dice" | "astro_timing"; requires_explicit_confirmation: boolean; note: string };
  knowledge_bank: { in_scope: boolean; note: string };
  prompt_system_version: {
    fixed_template_registry: string;
    persona_prompt_pipeline: string;
    persona_rule: string;
    persona_mapping: string;
    generative_prompt_assembled: boolean;
  };
  response_result_class: LabResultClass;
  model_identity: {
    provider_alias: string;
    deployment: string;
    model: string;
    model_version: string;
    hostname: string;
    safety_profile: string;
    ai_enabled: boolean;
  };
  latency: { total_ms: number; duration_bucket: "lt_1s" | "1_to_4s" | "4_to_12s" | "deadline" };
  usage_metadata: {
    internal_route_units: number | null;
    internal_units_note: string;
    prompt_token_estimate: number;
    output_token_estimate: number | null;
    customer_cost_display: "suppressed_by_preview_hold";
  };
  provider_attempts: 0 | 1 | 2;
  no_hidden_chain_of_thought: true;
};

export type LabResponse = {
  schema_version: typeof LAB_RESPONSE_SCHEMA;
  not_signed_off_customer_ui: true;
  canonical_state: CanonicalState;
  result: LabResultClass;
  language: LabLanguage;
  assistant_message: string | null;
  fixed_template: { template_id: string; family: FixedTemplateFamilyId; status: string; clinical_review_required: boolean } | null;
  handoff: { kind: "dice" | "astro_timing"; requires_explicit_confirmation: true; note: string; date_comparison_max?: 3 } | null;
  // Deterministic preview of the reviewed persona prompt that WOULD be sent for generative
  // routes (assembled by the reused persona-prompt-pipeline). Not chain-of-thought.
  generative_prompt_preview: string | null;
  error_code: string | null;
  persistence: "not_committed";
  units_charged: 0;
  idempotency_outcome: "not_committed";
  provider_attempts: 0 | 1 | 2;
  chart_composition: ChartComposition;
  decision_trace: DecisionTrace;
  // The disposable Lab mirrors the mobile Chat structured response result-class mapping.
  mobile_contract_alignment: {
    mobile_response_schema: typeof MOBILE_CHAT_RESPONSE_SCHEMA;
    synthetic_response_schema: typeof CHAT_SYNTHETIC_RESPONSE_SCHEMA;
    note: string;
  };
};

// ---------------------------------------------------------------------------
// Input validation (fails before any provider is contacted)
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true; request: LabRequest }
  | { ok: false; error_code: string; detail: string };

const MAX_MESSAGE_LENGTH = 1200;

export function validateLabRequest(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error_code: "LAB_REQUEST_INVALID", detail: "request must be a JSON object" };
  }
  const r = raw as Record<string, unknown>;
  const allowed = new Set(["schema_version", "role_code", "chart", "message", "app_language_preference", "context"]);
  const keys = Object.keys(r);
  if (keys.some((k) => !allowed.has(k))) {
    return { ok: false, error_code: "LAB_REQUEST_UNKNOWN_FIELD", detail: `unexpected field(s): ${keys.filter((k) => !allowed.has(k)).join(", ")}` };
  }
  if (r.schema_version !== LAB_REQUEST_SCHEMA) {
    return { ok: false, error_code: "LAB_REQUEST_SCHEMA_UNKNOWN", detail: "schema_version mismatch" };
  }
  if (typeof r.role_code !== "string" || !LAB_ROLE_CODES.includes(r.role_code as LabRoleCode)) {
    return { ok: false, error_code: "LAB_ROLE_NOT_APPROVED", detail: "role_code must be exactly one of the three approved role codes" };
  }
  const chart = r.chart;
  if (!chart || typeof chart !== "object" || Array.isArray(chart)) {
    return { ok: false, error_code: "LAB_CHART_INVALID", detail: "chart must be an object" };
  }
  const c = chart as Record<string, unknown>;
  const chartKeys = new Set(["sun", "moon", "mercury", "saturn", "moon_confirmed"]);
  if (Object.keys(c).some((k) => !chartKeys.has(k)) || Object.keys(c).length !== 5) {
    return { ok: false, error_code: "LAB_CHART_INVALID", detail: "chart requires exactly sun, moon, mercury, saturn, moon_confirmed" };
  }
  for (const p of ["sun", "moon", "mercury", "saturn"] as const) {
    if (!isSignNumber(c[p])) {
      return { ok: false, error_code: "LAB_SIGN_INVALID", detail: `${p} must be an integer sign number 1..12` };
    }
  }
  if (typeof c.moon_confirmed !== "boolean") {
    return { ok: false, error_code: "LAB_CHART_INVALID", detail: "moon_confirmed must be a boolean" };
  }
  if (typeof r.message !== "string") {
    return { ok: false, error_code: "LAB_MESSAGE_INVALID", detail: "message must be a string" };
  }
  const message = r.message.normalize("NFC");
  if (message.trim().length === 0) {
    return { ok: false, error_code: "LAB_MESSAGE_EMPTY", detail: "message must not be empty" };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error_code: "LAB_MESSAGE_TOO_LONG", detail: `message exceeds ${MAX_MESSAGE_LENGTH} chars` };
  }
  if (!(r.app_language_preference === null || isAppLanguagePreference(r.app_language_preference))) {
    return { ok: false, error_code: "LAB_LANGUAGE_INVALID", detail: "app_language_preference must be 'en', 'zh-Hant', or null" };
  }
  // Optional bounded rolling conversation context (browser-held; never persisted server-side).
  const context: ConversationTurn[] = [];
  if (r.context !== undefined) {
    if (!Array.isArray(r.context)) return { ok: false, error_code: "LAB_CONTEXT_INVALID", detail: "context must be an array" };
    if (r.context.length > MAX_CONTEXT_TURNS) return { ok: false, error_code: "LAB_CONTEXT_TOO_LONG", detail: `context exceeds ${MAX_CONTEXT_TURNS} turns` };
    for (const turn of r.context) {
      if (!turn || typeof turn !== "object" || Array.isArray(turn)) return { ok: false, error_code: "LAB_CONTEXT_INVALID", detail: "each context turn must be an object" };
      const t = turn as Record<string, unknown>;
      const tkeys = Object.keys(t);
      if (tkeys.length !== 2 || !tkeys.every((k) => k === "role" || k === "text")) return { ok: false, error_code: "LAB_CONTEXT_INVALID", detail: "each turn requires exactly role + text" };
      if (t.role !== "user" && t.role !== "assistant") return { ok: false, error_code: "LAB_CONTEXT_INVALID", detail: "turn.role must be 'user' or 'assistant'" };
      if (typeof t.text !== "string" || t.text.length === 0 || t.text.length > MAX_CONTEXT_TURN_LEN) return { ok: false, error_code: "LAB_CONTEXT_INVALID", detail: `turn.text must be 1..${MAX_CONTEXT_TURN_LEN} chars` };
      context.push({ role: t.role, text: t.text.normalize("NFC") });
    }
  }
  return {
    ok: true,
    request: {
      schema_version: LAB_REQUEST_SCHEMA,
      role_code: r.role_code as LabRoleCode,
      chart: { sun: c.sun as number, moon: c.moon as number, mercury: c.mercury as number, saturn: c.saturn as number, moon_confirmed: c.moon_confirmed as boolean },
      message,
      app_language_preference: (r.app_language_preference as AppLanguagePreference | null),
      context,
    },
  };
}

// ---------------------------------------------------------------------------
// Chart Composition (workbook v1.2 via reused persona-calculator)
// ---------------------------------------------------------------------------

function moonInput(chart: LabChartInput): CustomerMoonInput {
  return chart.moon_confirmed
    ? { status: "available", proof: "confirmed_birth_time", sign: chart.moon }
    : { status: "unconfirmed" };
}

export function deriveChartComposition(request: LabRequest): ChartComposition {
  const roleMeta = LAB_ROLES.find((x) => x.code === request.role_code)!;
  const calc = calculatePersonaProfile({
    roleCode: request.role_code,
    sunSign: request.chart.sun,
    mercurySign: request.chart.mercury,
    moon: moonInput(request.chart),
  });

  const fixedAscNote =
    "Role-fixed base presence, not a natal angle. Lumis has no birth time/ASC/cusps (S2-T23 CI-02/CI-03).";

  if (!calc.ok) {
    return {
      role: { code: request.role_code, current_label: roleMeta.currentLabel, internal_name: roleMeta.internalName },
      available: false,
      error_code: calc.code,
      fixed_asc: { sign: "—", note: fixedAscNote },
      factors: [],
      provided_placements: providedPlacements(request, new Set()),
      moon_status: request.chart.moon_confirmed ? "confirmed_birth_time" : "unconfirmed",
      source_rules_applied: [],
      rule_versions: { persona: "v1", mapping: "v1" },
      no_invented_data: true,
    };
  }

  const factors: ResolvedFactorView[] = calc.calculatedProfile.map((f) => ({
    factor: f.factor,
    sign: f.sign,
    signNumber: f.signNumber,
    source: f.source,
    offset: f.offset,
    note: factorNote(f.factor, f.source, f.offset, f.sourceRuleCode),
  }));

  // Which natal placements were consumed as a factor SOURCE?
  const consumed = new Set<string>();
  for (const f of calc.calculatedProfile) {
    if (f.source === "customer_sun") consumed.add("Sun");
    if (f.source === "customer_moon") consumed.add("Moon");
    if (f.source === "customer_mercury") consumed.add("Mercury");
    // Unconfirmed-Moon fallback consumes Sun in place of Moon.
  }
  // When Moon is unconfirmed, the Moon/Saturn factor is sourced from Sun; mark Sun consumed.
  if (!request.chart.moon_confirmed) consumed.add("Sun");

  const fixedAsc = calc.calculatedProfile.find((f) => f.factor === "ASC");

  return {
    role: { code: request.role_code, current_label: roleMeta.currentLabel, internal_name: roleMeta.internalName },
    available: true,
    fixed_asc: { sign: fixedAsc ? fixedAsc.sign : "—", note: fixedAscNote },
    factors,
    provided_placements: providedPlacements(request, consumed),
    moon_status: request.chart.moon_confirmed ? "confirmed_birth_time" : "unconfirmed",
    source_rules_applied: calc.sourceRulesApplied,
    rule_versions: { persona: calc.ruleVersion, mapping: "v1" },
    no_invented_data: true,
  };
}

function providedPlacements(request: LabRequest, consumed: Set<string>) {
  const map: Array<{ placement: "Sun" | "Moon" | "Mercury" | "Saturn"; sign: number }> = [
    { placement: "Sun", sign: request.chart.sun },
    { placement: "Moon", sign: request.chart.moon },
    { placement: "Mercury", sign: request.chart.mercury },
    { placement: "Saturn", sign: request.chart.saturn },
  ];
  return map.map(({ placement, sign }) => {
    let note = "";
    if (placement === "Saturn") {
      note = "Provided as chart provenance; not consumed by any current role's persona factors. The saturnian_anchor 'Saturn' factor is derived from Moon, not natal Saturn (workbook v1.2).";
    } else if (placement === "Moon" && !request.chart.moon_confirmed) {
      note = "Unconfirmed (no birth time): the Moon-sourced factor falls back to Customer Sun per role rule; the provided Moon sign is not used.";
    } else if (consumed.has(placement)) {
      note = "Consumed as a persona factor source for this role.";
    } else {
      note = "Provided; not consumed as a factor source for this role.";
    }
    return { placement, sign: signName(sign), consumed: consumed.has(placement) && !(placement === "Moon" && !request.chart.moon_confirmed), note };
  });
}

function factorNote(factor: string, source: string, offset: number, ruleCode?: string): string {
  if (factor === "ASC") return "Fixed role base presence (no natal angle).";
  const src =
    source === "customer_sun" ? "Customer Sun" :
    source === "customer_moon" ? "Customer Moon" :
    source === "customer_mercury" ? "Customer Mercury" : source;
  const rule = ruleCode ? ` [fallback: ${ruleCode}]` : "";
  return `${src} + ${offset} (A = ((U + offset - 1) mod 12) + 1)${rule}`;
}

// ---------------------------------------------------------------------------
// Route planning (safety-first, then reused classifier, then canonical refinement)
// ---------------------------------------------------------------------------

const PROFESSIONAL_DIRECT = /(diagnos|prescrib|medication|dosage|treat(ment)?|symptom|guarantee|sue|lawsuit|legally|invest(ment)?\b|tax\b|診斷|處方|藥物|劑量|治療|症狀|保證|訴訟|投資|報稅)/i;

export type LabPlan = {
  language: LabLanguage;
  languageSource: DecisionTrace["language_source"];
  requestTextLanguage: LabLanguage;
  baseRoute: ChatRoute;
  canonicalState: CanonicalState;
  templateFamily: FixedTemplateFamilyId | null;
  safety: LabSafetyLevel;
  outOfScopeKind: DecisionTrace["out_of_scope_result"]["kind"];
  handoff: LabResponse["handoff"];
  generative: boolean;
  fixedTemplateText: string | null;
  fixedTemplateId: string | null;
  fixedTemplateStatus: string | null;
  fixedTemplateClinicalReview: boolean;
  personaPromptAssembled: boolean;
  personaPromptPayload: unknown | null;
  composition: ChartComposition;
};

const loadFixedTemplate = createFixedTemplateServerLoader(() => "staging");

function templateFor(family: FixedTemplateFamilyId, language: LabLanguage) {
  const res = loadFixedTemplate({ registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION, familyId: family, language: language as FixedTemplateLanguage });
  if (!res.ok) throw new Error(`FIXED_TEMPLATE_LOOKUP_FAILED:${res.error.code}:${family}`);
  return res.value;
}

// Build the fully-deterministic plan for a validated request.
export function planLabTurn(request: LabRequest): LabPlan {
  const resolved = resolveFixedTemplateLanguage(request.app_language_preference, request.message) as LabLanguage;
  const requestTextLanguage = detectRequestLanguage(request.message) as LabLanguage;
  const languageSource: DecisionTrace["language_source"] =
    isAppLanguagePreference(request.app_language_preference) ? "saved_app_language_preference" : "request_text_detection";

  const composition = deriveChartComposition(request);

  // Chart gate first: Mercury required for all roles; invalid/incomplete chart stops generation.
  if (!composition.available) {
    return basePlan(request, resolved, languageSource, requestTextLanguage, "casual", {
      canonicalState: "chart_unavailable",
      templateFamily: "ROUTE_UNAVAILABLE",
      generative: false,
      composition,
    });
  }

  const baseRoute = classifyChatRoute(request.message);
  const safety = labSafetyClassify(request.message);

  // Safety override precedes everything (persona Prompt_Assembly priority 1).
  if (safety === "crisis_imminent" || baseRoute === "safety") {
    return fixedPlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "crisis_imminent", "CRISIS_IMMINENT", { safety: "crisis_imminent" });
  }
  if (safety === "illegal_boundary") {
    return fixedPlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "illegal_boundary", "ILLEGAL_BOUNDARY", { safety, outOfScopeKind: "illegal" });
  }
  if (safety === "distress_safety_check") {
    return fixedPlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "distress_safety_check", "DISTRESS_SAFETY_CHECK", { safety });
  }

  // Out-of-scope family (reused classifier returns out_of_scope for medical/legal/finance/solar-return).
  if (baseRoute === "out_of_scope") {
    if (isSolarReturnRequest(request.message)) {
      return fixedPlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "out_of_scope_solar_return", "OUT_OF_SCOPE_SOLAR_RETURN", { outOfScopeKind: "solar_return" });
    }
    if (PROFESSIONAL_DIRECT.test(request.message)) {
      return fixedPlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "professional_direct", "PROFESSIONAL_BOUNDARY", { outOfScopeKind: "professional_direct" });
    }
    return fixedPlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "out_of_scope", "OUT_OF_SCOPE", { outOfScopeKind: "general" });
  }

  // Timing handoff: never silently upgraded; offer explicit confirmation (AC-AI-00 §4/§5, DEC-06).
  if (baseRoute === "astro_timing") {
    return basePlan(request, resolved, languageSource, requestTextLanguage, baseRoute, {
      canonicalState: "astro_timing_handoff",
      templateFamily: null,
      generative: false,
      composition,
      handoff: { kind: "astro_timing", requires_explicit_confirmation: true, note: "Confirm a timing window or a specific-date comparison (max 3 dates) before any timing analysis runs. 5 internal units per completed timing route.", date_comparison_max: 3 },
    });
  }

  // Dice-shaped Chat: normal Lumis response + user-confirmed Go to Dice (AC-AI-00 §5, G6).
  if (baseRoute === "dice") {
    return generativePlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, "dice_handoff", {
      handoff: { kind: "dice", requires_explicit_confirmation: true, note: "Normal Lumis response with a user-confirmed 'Go to Dice' button. No silent handoff or automatic throw." },
    });
  }

  // Normal generative routes.
  const canonical: CanonicalState = baseRoute === "knowledge" ? "knowledge" : baseRoute === "astro_deep" ? "astro_deep" : "casual";
  return generativePlan(request, resolved, languageSource, requestTextLanguage, baseRoute, composition, canonical, {});
}

function basePlan(
  request: LabRequest,
  language: LabLanguage,
  languageSource: DecisionTrace["language_source"],
  requestTextLanguage: LabLanguage,
  baseRoute: ChatRoute,
  opts: { canonicalState: CanonicalState; templateFamily: FixedTemplateFamilyId | null; generative: boolean; composition: ChartComposition; handoff?: LabResponse["handoff"]; safety?: LabSafetyLevel; outOfScopeKind?: DecisionTrace["out_of_scope_result"]["kind"] },
): LabPlan {
  let fixedText: string | null = null;
  let fixedId: string | null = null;
  let fixedStatus: string | null = null;
  let fixedClinical = false;
  if (opts.templateFamily && opts.canonicalState !== "chart_unavailable") {
    const tpl = templateFor(opts.templateFamily, language);
    fixedText = tpl.text; fixedId = tpl.templateId; fixedStatus = tpl.status; fixedClinical = false;
  }
  return {
    language, languageSource, requestTextLanguage, baseRoute,
    canonicalState: opts.canonicalState,
    templateFamily: opts.templateFamily,
    safety: opts.safety ?? null,
    outOfScopeKind: opts.outOfScopeKind ?? null,
    handoff: opts.handoff ?? null,
    generative: opts.generative,
    fixedTemplateText: fixedText,
    fixedTemplateId: fixedId,
    fixedTemplateStatus: fixedStatus,
    fixedTemplateClinicalReview: fixedClinical,
    personaPromptAssembled: false,
    personaPromptPayload: null,
    composition: opts.composition,
  };
}

function fixedPlan(
  request: LabRequest,
  language: LabLanguage,
  languageSource: DecisionTrace["language_source"],
  requestTextLanguage: LabLanguage,
  baseRoute: ChatRoute,
  composition: ChartComposition,
  canonicalState: CanonicalState,
  family: FixedTemplateFamilyId,
  extra: { safety?: LabSafetyLevel; outOfScopeKind?: DecisionTrace["out_of_scope_result"]["kind"] },
): LabPlan {
  const tpl = templateFor(family, language);
  return {
    language, languageSource, requestTextLanguage, baseRoute,
    canonicalState,
    templateFamily: family,
    safety: extra.safety ?? null,
    outOfScopeKind: extra.outOfScopeKind ?? null,
    handoff: null,
    generative: false,
    fixedTemplateText: tpl.text,
    fixedTemplateId: tpl.templateId,
    fixedTemplateStatus: tpl.status,
    fixedTemplateClinicalReview: family === "CRISIS_IMMINENT" || family === "DISTRESS_SAFETY_CHECK",
    personaPromptAssembled: false,
    personaPromptPayload: null,
    composition,
  };
}

function generativePlan(
  request: LabRequest,
  language: LabLanguage,
  languageSource: DecisionTrace["language_source"],
  requestTextLanguage: LabLanguage,
  baseRoute: ChatRoute,
  composition: ChartComposition,
  canonicalState: CanonicalState,
  extra: { handoff?: LabResponse["handoff"] },
): LabPlan {
  // Assemble the reviewed persona prompt deterministically (no provider call here).
  const pipeline = runPersonaPromptPipeline(
    {
      pipelineVersion: PERSONA_PROMPT_PIPELINE_VERSION,
      roleCode: request.role_code,
      customerSigns: { sunSign: request.chart.sun, mercurySign: request.chart.mercury, moon: moonInput(request.chart) },
      safetyMode: "standard",
      emotionalState: "steady",
      language,
    },
    { authority: "trusted_server_config", enabled: true },
  );
  return {
    language, languageSource, requestTextLanguage, baseRoute,
    canonicalState,
    templateFamily: null,
    safety: null,
    outOfScopeKind: null,
    handoff: extra.handoff ?? null,
    generative: true,
    fixedTemplateText: null,
    fixedTemplateId: null,
    fixedTemplateStatus: null,
    fixedTemplateClinicalReview: false,
    personaPromptAssembled: pipeline.ok,
    personaPromptPayload: pipeline.ok ? pipeline.value : { error: pipeline.error },
    composition,
  };
}

// ---------------------------------------------------------------------------
// Internal-unit metadata (AC-AI-00 §3). Disposable Lab always charges 0.
// ---------------------------------------------------------------------------

export function internalRouteUnits(state: CanonicalState): { units: number | null; note: string } {
  switch (state) {
    case "casual": return { units: getChatRouteDecision("casual").credits, note: "AC-AI-00 §3 casual = 1 (internal only; Lab charges 0)." };
    case "knowledge": return { units: getChatRouteDecision("knowledge").credits, note: "AC-AI-00 §3 knowledge = 3 (internal only; Lab charges 0)." };
    case "astro_deep": return { units: getChatRouteDecision("astro_deep").credits, note: "AC-AI-00 §3 astro_deep = 5 (internal only; Lab charges 0)." };
    case "dice_handoff": return { units: 1, note: "Normal Lumis response = 1 unit; the 5-unit dice route applies only after an explicit Go-to-Dice in Dice (internal only; Lab charges 0)." };
    case "astro_timing_handoff": return { units: 0, note: "Handoff offer only = 0 units; 5 units per completed timing window/date (max 3 dates) after explicit confirmation (internal only; Lab charges 0)." };
    case "out_of_scope": case "out_of_scope_solar_return": return { units: 1, note: "AC-AI-00 §3 out_of_scope successful redirect = 1 (internal only; Lab charges 0)." };
    case "professional_direct": return { units: 1, note: "AC-AI-00 §3 professional_direct fixed completion = 1 (internal only; Lab charges 0)." };
    case "crisis_imminent": case "distress_safety_check": return { units: 1, note: "AC-AI-00 §3 crisis/safety fixed completion = 1 (internal only; Lab charges 0)." };
    case "illegal_boundary": return { units: null, note: "Not separately enumerated in AC-AI-00 §3; fixed boundary. Disposable Lab charges 0." };
    case "route_unavailable": case "router_unavailable": case "chart_unavailable": case "technical_error":
      return { units: 0, note: "0-unit non-completed state (AC-AI-00 §2/§3)." };
    default: return { units: null, note: "n/a" };
  }
}

// crude, deterministic token estimate (no external tokenizer dependency in the Lab).
export function estimateTokens(text: string): number {
  return Math.ceil(String(text ?? "").length / 4);
}
