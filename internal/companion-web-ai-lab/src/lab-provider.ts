// Companion / Normal Chat Web AI Lab — provider layer (server-side only).
//
// Default-OFF. With no server configuration the Lab makes ZERO provider calls.
// When the operator explicitly sets LUMIS_CHAT_AI_ENABLED=true and supplies
// LUMIS_CHAT_AZURE_API_KEY server-side, the Lab reuses the T350 Azure adapter with the
// same discipline as the synthetic gateway (one attempt + one retry, 12s deadline,
// post-safety check) to produce one real staging response. No credentials are ever sent
// to the browser, logged, or included in any response payload.
//
// Reused: readChatAzureServerConfig + createAzureChatSyntheticAdapter (server-side identity
// and transport), COMPANION_SYNTHETIC_PROMPT_VERSION (prompt-version literal for the adapter).

import {
  readChatAzureServerConfig,
  createAzureChatSyntheticAdapter,
} from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";
import { COMPANION_SYNTHETIC_PROMPT_VERSION } from "../../../supabase/functions/_shared/companion-synthetic-prompt-v1.ts";
import {
  CHAT_SYNTHETIC_PROVIDER_ALIAS,
  CHAT_SYNTHETIC_SAFETY_PROFILE,
  LAB_PROVIDER_DEADLINE_MS,
  LAB_PROVIDER_MAX_OUTPUT_TOKENS,
  type LabLanguage,
} from "./lab-constants.ts";

export type ProviderRuntime =
  | { aiEnabled: false; code: "CHAT_AI_DISABLED" | string }
  | { aiEnabled: true; adapter: ReturnType<typeof createAzureChatSyntheticAdapter> };

// Resolve provider runtime from server environment (never from the browser request).
export function resolveProviderRuntime(
  environment: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch = fetch,
  nowMs: () => number = Date.now,
): ProviderRuntime {
  const config = readChatAzureServerConfig(environment);
  if (!config.ok) return { aiEnabled: false, code: config.code };
  return { aiEnabled: true, adapter: createAzureChatSyntheticAdapter(config.config, fetchImpl, nowMs) };
}

export type ProviderOutcome =
  | { kind: "disabled"; code: string; attempts: 0 }
  | { kind: "completed"; message: string; attempts: 1 | 2 }
  | { kind: "safety_rejected"; attempts: 1 | 2; code: string }
  | { kind: "fixed_fallback"; attempts: 1 | 2; code: string }
  | { kind: "router_unavailable"; attempts: 1 | 2; code: string }
  | { kind: "technical_error"; attempts: 1 | 2; code: string };

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

    if (result.kind === "completed") {
      const message = normalizeAssistantMessage(result.assistantMessage);
      if (!message) return { kind: "fixed_fallback", attempts, code: "LAB_OUTPUT_INVALID" };
      if (!passesDeterministicPostSafety(message)) return { kind: "safety_rejected", attempts, code: "LAB_POST_SAFETY" };
      return { kind: "completed", message, attempts };
    }
    if (result.kind === "content_filter_block" || result.kind === "content_filter_partial") {
      return { kind: "safety_rejected", attempts, code: "LAB_CONTENT_FILTER" };
    }
    const retryable = result.kind === "timeout" || result.kind === "network" || result.kind === "rate_limited" || result.kind === "server_error";
    if (retryable && attempts === 1 && nowMs() < deadlineAtMs) {
      attempts = 2;
      continue;
    }
    // AC-AI-00 DEC-02: provider failure after one retry -> router_unavailable (0 units), fixed copy.
    if (retryable) return { kind: "router_unavailable", attempts, code: `LAB_PROVIDER_${result.kind.toUpperCase()}` };
    // unauthorized / forbidden / malformed -> content-free technical error.
    return { kind: "technical_error", attempts, code: `LAB_PROVIDER_${result.kind.toUpperCase()}` };
  }
}

// Serialize the reviewed persona prompt payload + the test message into a provider prompt string.
// The persona payload content is authored in the controlled Persona Behaviour Mapping workbook and
// assembled by the reused persona-prompt-pipeline; this is only a deterministic transport wrapper.
export function serializePersonaPrompt(payload: unknown, userMessage: string, language: LabLanguage): string {
  const p = payload as {
    roleContract?: { publicName?: string; corePurpose?: string; requiredBehaviors?: string; baseTone?: string; hardGuardrail?: string };
    situationParameters?: Record<string, string>;
    behaviorModifiers?: string[];
    responseInstruction?: string;
    safetyOverride?: boolean;
  };
  const rc = p.roleContract ?? {};
  const lines: string[] = [];
  lines.push(`You are Lumis Companion in the internal persona role "${rc.publicName ?? ""}".`);
  lines.push(`Core purpose: ${rc.corePurpose ?? ""}`);
  lines.push(`Required behaviours: ${rc.requiredBehaviors ?? ""}`);
  lines.push(`Base tone: ${rc.baseTone ?? ""}`);
  lines.push(`Hard guardrail: ${rc.hardGuardrail ?? ""}`);
  if (Array.isArray(p.behaviorModifiers) && p.behaviorModifiers.length) {
    lines.push(`Behaviour modifiers:`);
    for (const m of p.behaviorModifiers) lines.push(`- ${m}`);
  }
  if (p.situationParameters) {
    lines.push(`Situation parameters: ${Object.entries(p.situationParameters).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  lines.push(`Language: respond only in ${language === "zh-Hant" ? "Traditional Chinese (zh-Hant)" : "English"}.`);
  lines.push(`${p.responseInstruction ?? "Respond naturally; do not mention internal calculations, mapping IDs, or sign maths."}`);
  lines.push("");
  lines.push("User message:");
  lines.push(userMessage);
  return lines.join("\n");
}
