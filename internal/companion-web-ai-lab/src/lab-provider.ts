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

// Serialize the reviewed persona prompt payload + the test message into a provider prompt string.
// The persona payload content is authored in the controlled Persona Behaviour Mapping workbook and
// assembled by the reused persona-prompt-pipeline; this is only a deterministic transport wrapper.
// A minimal view of the server-derived Chart Composition (workbook calculated_profile) so the
// system prompt can name the Companion's resolved factor signs — which the workbook's Recommended
// prompt payload lists as `calculated_profile`. The signs shape HOW Lumis speaks; per Prompt_Assembly
// layer 7 they are never surfaced to the member.
export type PersonaComposition = {
  available?: boolean;
  fixed_asc?: { sign?: string };
  factors?: ReadonlyArray<{ factor?: string; sign?: string }>;
};

// Strip the workbook's flat "Apply this as a <layer> modifier. " lead-in so the modifier reads as
// character rather than boilerplate. The behavioural text itself is preserved verbatim.
function cleanModifier(m: string): string {
  return m.replace(/^Apply this as an?\s+[a-z ]+?\s+modifier\.\s*/i, "").trim();
}

export function serializePersonaPrompt(
  payload: unknown,
  userMessage: string,
  language: LabLanguage,
  context: ReadonlyArray<{ role: "user" | "assistant"; text: string }> = [],
  composition?: PersonaComposition,
  knowledgeGrounding?: string | null,
): string {
  const p = payload as {
    roleContract?: { publicName?: string; corePurpose?: string; requiredBehaviors?: string; baseTone?: string; hardGuardrail?: string };
    situationParameters?: Record<string, string>;
    behaviorModifiers?: string[];
    responseInstruction?: string;
    safetyOverride?: boolean;
  };
  const rc = p.roleContract ?? {};
  const zh = language === "zh-Hant";
  const lines: string[] = [];
  lines.push(`You are Lumis, a warm astrology companion, speaking in the "${rc.publicName ?? ""}" persona role.`);
  lines.push(`Core purpose: ${rc.corePurpose ?? ""}`);
  lines.push(`Base tone: ${rc.baseTone ?? ""}`);
  lines.push(`Hard guardrail: ${rc.hardGuardrail ?? ""}`);

  // calculated_profile: name the Companion's server-derived factor signs (never revealed to the user).
  if (composition && composition.available !== false && Array.isArray(composition.factors) && composition.factors.length) {
    const asc = composition.fixed_asc?.sign;
    const pairs = composition.factors
      .filter((f) => f && f.factor && f.sign)
      .map((f) => `${f.factor === "ASC" ? "Rising" : f.factor} ${f.sign}`);
    lines.push("");
    lines.push("Your persona shaping (this guides your tone and manner only; there is no need to mention astrology or these signs):");
    lines.push(`  ${pairs.join(" · ")}${asc && !pairs.some((x) => x.startsWith("Rising")) ? ` · Rising ${asc}` : ""}`);
  }

  // behaviour_modifiers: the Companion's character to embody (cleaned of workbook boilerplate).
  if (Array.isArray(p.behaviorModifiers) && p.behaviorModifiers.length) {
    lines.push("");
    lines.push("Let these shape how you speak:");
    for (const m of p.behaviorModifiers) lines.push(`- ${cleanModifier(m)}`);
  }

  // Knowledge Bank grounding: controlled natal facts about the person (planet-in-sign only).
  if (knowledgeGrounding && knowledgeGrounding.trim()) {
    lines.push("");
    lines.push(knowledgeGrounding.trim());
  }

  if (p.situationParameters) {
    lines.push(`Situation parameters: ${Object.entries(p.situationParameters).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  // Response guidance: reduce the "plain AI keeps asking questions" feel while honouring the role
  // contract (which offers listening-vs-organising as a one-time choice, not an every-turn question)
  // and the AC-AI-00 §9.1 length baseline.
  lines.push("");
  lines.push("How to reply:");
  lines.push(`- Speak warmly in the first person; reflect the feeling first, then say something substantive and specific to what they shared.`);
  lines.push(`- ${rc.requiredBehaviors ?? "Reflect feelings first; keep advice light unless invited."}`);
  lines.push(`- You may offer, at most once and only early in a new conversation, whether they would like you to simply listen or help organise their thoughts. After that, keep responding without repeating the question, and let most replies end with a warm, grounded statement rather than a question.`);
  lines.push(`- Aim for about ${zh ? "160–260 Traditional Chinese characters" : "90–140 words"}, speaking naturally as a companion.`);
  lines.push(`Language: respond only in ${zh ? "Traditional Chinese (zh-Hant)" : "English"}.`);

  if (context.length) {
    lines.push("");
    lines.push("Conversation so far (respond to the latest user message in this ongoing conversation):");
    for (const turn of context) lines.push(`${turn.role === "assistant" ? "Lumis" : "User"}: ${turn.text}`);
  }
  lines.push("");
  lines.push("Latest user message:");
  lines.push(userMessage);
  return lines.join("\n");
}
