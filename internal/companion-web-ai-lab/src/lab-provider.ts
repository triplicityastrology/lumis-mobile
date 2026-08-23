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
import { createLabAzureResponsesAdapter, type ProviderDisposition } from "./lab-azure-responses-adapter.ts";
import { buildVoiceCard, type VoiceCard } from "./lab-persona-voice.ts";
import { COMPANION_NATURALNESS_RULES } from "../../../supabase/functions/_shared/companion-voice-and-naturalness-v1.ts";
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
  | { kind: "safety_rejected"; attempts: 1 | 2; code: string; providerDisposition: ProviderDisposition | null }
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
      return { kind: "safety_rejected", attempts, code: "LAB_CONTENT_FILTER", providerDisposition: disposition };
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

// Character-expression + naturalness rules are the Founder-approved CHAT-05 revision, held in the
// SHARED canonical source (companion-voice-and-naturalness-v1.ts) so the Lab and the future mobile
// Normal Chat route use one identical copy with no drift. See COMPANION_NATURALNESS_RULES.

// Assemble the full system prompt as ordered, labelled blocks (Founder-specified structure). The
// returned `blocks` + `voice_card` power the founder preview; `prompt` is what the provider receives.
export function assemblePersona(
  payload: unknown,
  userMessage: string,
  language: LabLanguage,
  context: ReadonlyArray<{ role: "user" | "assistant"; text: string }> = [],
  composition?: PersonaComposition,
  memberContext?: string | null,
): PersonaAssembly {
  const p = payload as {
    roleContract?: { publicName?: string; corePurpose?: string; requiredBehaviors?: string; baseTone?: string; hardGuardrail?: string };
    situationParameters?: Record<string, string>;
  };
  const rc = p.roleContract ?? {};
  const zh = language === "zh-Hant";
  const roleLabel = rc.publicName ?? composition?.role?.current_label ?? "";
  const roleCode = composition?.role?.code ?? "";
  const voice = composition ? buildVoiceCard(composition, roleLabel, roleCode) : null;

  const blocks: PersonaBlock[] = [];
  blocks.push({ name: "1. LUMIS IDENTITY", text: "Lumis is the astrology companion in this real, ongoing conversation with one person." });
  blocks.push({ name: "2. GROUNDING", text: "Stay honest and grounded, and keep the conversation constructive." });
  const sp = p.situationParameters ? Object.entries(p.situationParameters).map(([k, v]) => `${k} ${String(v).replace(/_/g, " ")}`).join(", ") : "";
  blocks.push({ name: "3. CURRENT SITUATION ADJUSTMENT", text: `${sp ? sp + ". " : ""}Match your pace, depth, and length to this message.` });
  blocks.push({ name: "4. ROLE", text: `Role: ${roleLabel} (${roleCode}). Your job: ${rc.corePurpose ?? ""} This job never changes. How you carry it out varies with the person and the moment — see the Character Voice below. Manner: ${rc.requiredBehaviors ?? ""}` });
  if (voice) blocks.push({ name: "5. LUMIS CHARACTER VOICE", text: voice.card_text });
  blocks.push({ name: "6. CHARACTER EXPRESSION AND NATURALNESS RULES", text: COMPANION_NATURALNESS_RULES.map((r) => `- ${r}`).join("\n") });
  if (memberContext && memberContext.trim()) blocks.push({ name: "7. RELEVANT MEMBER CONTEXT", text: memberContext.trim() });
  if (context.length) blocks.push({ name: "8. CONVERSATION CONTINUITY", text: "This is an ongoing conversation — keep the same voice and stay consistent with what was already said:\n" + context.map((t) => `${t.role === "assistant" ? "Lumis" : "Them"}: ${t.text}`).join("\n") });
  blocks.push({ name: "9. LANGUAGE AND FLEXIBLE LENGTH", text: `Respond only in ${zh ? "Traditional Chinese (zh-Hant)" : "English"}. Use the shortest natural response that adequately meets the moment — around ${zh ? "110–260 characters" : "60–140 words"} is normal, but a short emotional message may need less and a complex reflection more. A brief emotional statement (for example "I am upset") does not need a long analysis. Don't add structure or filler to hit a length.` });
  blocks.push({ name: "10. CURRENT USER MESSAGE", text: userMessage });

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
): string {
  return assemblePersona(payload, userMessage, language, context, composition, memberContext).prompt;
}
