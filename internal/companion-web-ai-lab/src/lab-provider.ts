// Companion / Normal Chat Web AI Lab — provider layer (server-side only).
//
// Default-OFF. With no server configuration the Lab makes ZERO provider calls.
// When the operator explicitly sets LUMIS_CHAT_AI_ENABLED=true and supplies
// LUMIS_CHAT_AZURE_API_KEY server-side, the Lab reuses the T350 Azure adapter with the
// same discipline as the synthetic gateway (one attempt + one retry, 12s deadline,
// post-safety check) to produce one real staging response. No credentials are ever sent
// to the browser, logged, or included in any response payload.
//
// Reused: readChatAzureServerConfig (server-side identity gate), COMPANION_SYNTHETIC_PROMPT_VERSION
// (prompt-version literal). Transport uses the Lab-local Azure Responses adapter, which corrects the
// request/parser boundary and reports a metadata-only provider_disposition (see
// lab-azure-responses-adapter.ts). The shared mobile-chat adapter is left untouched.

import { readChatAzureServerConfig } from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";
import { createLabAzureResponsesAdapter, type ProviderDisposition, type ContentFilterCategoryHit } from "./lab-azure-responses-adapter.ts";
import { buildVoiceCard, BEHAVIOUR_BANK, type VoiceCard } from "./lab-persona-voice.ts";
import { assembleCompanionPromptV3 } from "../../../supabase/functions/_shared/companion-synthesis-v1.ts";
import { COMPANION_SYNTHETIC_PROMPT_VERSION } from "../../../supabase/functions/_shared/companion-synthetic-prompt-v1.ts";
import {
  CHAT_SYNTHETIC_PROVIDER_ALIAS,
  CHAT_SYNTHETIC_SAFETY_PROFILE,
  LAB_PROVIDER_DEADLINE_MS,
  LAB_PROVIDER_MAX_OUTPUT_TOKENS,
  type LabLanguage,
} from "./lab-constants.ts";

export type { ProviderDisposition };

export type ProviderRuntime =
  | { aiEnabled: false; code: "CHAT_AI_DISABLED" | string }
  | { aiEnabled: true; adapter: ReturnType<typeof createLabAzureResponsesAdapter> };

// Resolve provider runtime from server environment (never from the browser request).
export function resolveProviderRuntime(
  environment: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch = fetch,
  nowMs: () => number = Date.now,
): ProviderRuntime {
  const config = readChatAzureServerConfig(environment);
  if (!config.ok) return { aiEnabled: false, code: config.code };
  return { aiEnabled: true, adapter: createLabAzureResponsesAdapter(config.config, fetchImpl, nowMs) };
}

export type ProviderOutcome =
  | { kind: "disabled"; code: string; attempts: 0; providerDisposition: null }
  | { kind: "completed"; message: string; attempts: 1 | 2; providerDisposition: ProviderDisposition | null }
  | { kind: "safety_rejected"; attempts: 1 | 2; code: string; providerDisposition: ProviderDisposition | null; contentFilterDiagnostic?: ContentFilterCategoryHit[] | null }
  | { kind: "fixed_fallback"; attempts: 1 | 2; code: string; providerDisposition: ProviderDisposition | null }
  | { kind: "router_unavailable"; attempts: 1 | 2; code: string; providerDisposition: ProviderDisposition | null }
  | { kind: "technical_error"; attempts: 1 | 2; code: string; providerDisposition: ProviderDisposition | null };

// Byte-exact copy of chat-synthetic-gateway-v1.ts passesDeterministicPostSafety() (verified by tests).
function passesDeterministicPostSafety(value: string): boolean {
  return !/\[\[unsafe\]\]|provider_secret|api[-_ ]?key|bearer\s+[a-z0-9._-]+/iu.test(value);
}

// Byte-exact copy of chat-synthetic-gateway-v1.ts normalizeAssistantMessage() (verified by tests).
function normalizeAssistantMessage(value: string): string | null {
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  return normalized.length > 0 && normalized.length <= 1800 ? normalized : null;
}

// Run one generative turn against the enabled adapter, with one internal retry (AC-AI-00 DEC-02).
export async function runGenerative(
  runtime: Extract<ProviderRuntime, { aiEnabled: true }>,
  promptInput: string,
  language: LabLanguage,
  nowMs: () => number = Date.now,
): Promise<ProviderOutcome> {
  const startedAt = nowMs();
  const deadlineAtMs = startedAt + LAB_PROVIDER_DEADLINE_MS;
  let attempts: 1 | 2 = 1;
  for (;;) {
    const result = await runtime.adapter.complete({
      providerAlias: CHAT_SYNTHETIC_PROVIDER_ALIAS,
      safetyProfile: CHAT_SYNTHETIC_SAFETY_PROFILE,
      // Correction round #7: this is the reused synthetic-gateway prompt-version LITERAL required by the
      // Azure Responses adapter's identity binding — deliberately the base gateway version, NOT the Lab
      // architecture label. Founder-facing traceability (persisted session, prompt snapshot/hash, Excel
      // export, identity receipt) records the FULL LAB_PROMPT_VERSION ending in +arch_v3; the two are
      // distinct on purpose and must not be conflated.
      promptVersion: COMPANION_SYNTHETIC_PROMPT_VERSION,
      language,
      promptInput,
      maxOutputTokens: LAB_PROVIDER_MAX_OUTPUT_TOKENS,
      deadlineAtMs,
    });
    const disposition = result.provider_disposition ?? null;

    if (result.kind === "completed") {
      const message = normalizeAssistantMessage(result.assistantMessage);
      if (!message) return { kind: "fixed_fallback", attempts, code: "LAB_OUTPUT_INVALID", providerDisposition: disposition };
      if (!passesDeterministicPostSafety(message)) return { kind: "safety_rejected", attempts, code: "LAB_POST_SAFETY", providerDisposition: disposition };
      return { kind: "completed", message, attempts, providerDisposition: disposition };
    }
    if (result.kind === "content_filter_block" || result.kind === "content_filter_partial") {
      // Redacted, closed content-filter summary is present only under the staging diagnostic flag.
      return { kind: "safety_rejected", attempts, code: "LAB_CONTENT_FILTER", providerDisposition: disposition, contentFilterDiagnostic: result.content_filter_diagnostic ?? null };
    }
    const retryable = result.kind === "timeout" || result.kind === "network" || result.kind === "rate_limited" || result.kind === "server_error";
    if (retryable && attempts === 1 && nowMs() < deadlineAtMs) {
      attempts = 2;
      continue;
    }
    // AC-AI-00 DEC-02: provider failure after one retry -> router_unavailable (0 units), fixed copy.
    if (retryable) return { kind: "router_unavailable", attempts, code: `LAB_PROVIDER_${result.kind.toUpperCase()}`, providerDisposition: disposition };
    // unauthorized / forbidden / malformed -> content-free technical error.
    return { kind: "technical_error", attempts, code: `LAB_PROVIDER_${result.kind.toUpperCase()}`, providerDisposition: disposition };
  }
}

// Chart Composition view (workbook calculated_profile) used to build the Character Voice from the
// approved Behaviour Mapping rows. Includes the role so the Voice Card can name it.
export type PersonaComposition = {
  available?: boolean;
  role?: { code?: string; current_label?: string; internal_name?: string };
  fixed_asc?: { sign?: string };
  factors?: ReadonlyArray<{ factor?: string; sign?: string }>;
};

export type PersonaBlock = { name: string; text: string };
export type PersonaAssembly = { prompt: string; blocks: PersonaBlock[]; voice_card: VoiceCard | null };

export type MemberChart = { sun: number; moon: number; mercury: number; saturn: number; moon_confirmed: boolean };

// Assemble the full Prompt v3 system prompt. The 10-block assembly itself lives in the SHARED canonical
// source (assembleCompanionPromptV3); the Lab only resolves the voice-card factor flavours (from the
// shared Persona Behaviour Mapping v1.3) and passes them in. The Lab maintains NO independent Prompt v3
// assembly, so Lab and future mobile cannot drift. The returned `blocks` + `voice_card` power the
// founder preview; `prompt` is what the provider receives.
export function assemblePersona(
  payload: unknown,
  userMessage: string,
  language: LabLanguage,
  context: ReadonlyArray<{ role: "user" | "assistant"; text: string }> = [],
  composition?: PersonaComposition,
  memberContext?: string | null,
  memberChart?: MemberChart | null,
): PersonaAssembly {
  const p = payload as {
    roleContract?: { publicName?: string; corePurpose?: string; requiredBehaviors?: string; baseTone?: string; hardGuardrail?: string };
    situationParameters?: Record<string, string>;
  };
  const rc = p.roleContract ?? {};
  const roleLabel = rc.publicName ?? composition?.role?.current_label ?? "";
  const roleCode = composition?.role?.code ?? "";
  const voice = composition ? buildVoiceCard(composition, roleLabel, roleCode) : null;
  const flav = (factor: string): string | null => {
    const r = voice ? voice.rows.find((x) => x.factor === factor) : undefined;
    return r ? BEHAVIOUR_BANK[r.mapping_id].flavour : null;
  };

  const blocks = assembleCompanionPromptV3({
    roleLabel,
    roleCode,
    // roleContract omitted -> the shared assembler uses the canonical ROLE_CONTRACT_V3[roleCode].
    situationParams: p.situationParameters ?? null,
    factorFlavours: voice ? { asc: flav("ASC"), sun: flav("Sun"), moon: flav("Moon"), saturn: flav("Saturn"), mercury: flav("Mercury") } : null,
    memberChart: memberChart ?? null,
    memberFacts: memberContext ?? null,
    history: context,
    language,
    userMessage,
  });

  const prompt = blocks.map((b) => `===== ${b.name} =====\n${b.text}`).join("\n\n");
  return { prompt, blocks, voice_card: voice };
}

// Back-compat wrapper: returns just the assembled prompt string (used by runGenerative + token est).
export function serializePersonaPrompt(
  payload: unknown,
  userMessage: string,
  language: LabLanguage,
  context: ReadonlyArray<{ role: "user" | "assistant"; text: string }> = [],
  composition?: PersonaComposition,
  memberContext?: string | null,
  memberChart?: MemberChart | null,
): string {
  return assemblePersona(payload, userMessage, language, context, composition, memberContext, memberChart).prompt;
}
