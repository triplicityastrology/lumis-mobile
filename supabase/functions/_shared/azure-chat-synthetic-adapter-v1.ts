import type { ChatSyntheticAdapter, ProviderResult } from "./chat-synthetic-gateway-v1.ts";

export const CHAT_AZURE_APPROVED_HOSTNAME = "lumis-foundry-stg-sea-20260731.services.ai.azure.com" as const;
export const CHAT_AZURE_ROUTE_FAMILY = "v1" as const;
export const CHAT_AZURE_API_VERSION = null;
export const CHAT_AZURE_DEPLOYMENT = "lumis-ai-chat-stg" as const;
export const CHAT_AZURE_MODEL = "gpt-5-mini" as const;
export const CHAT_AZURE_MODEL_VERSION = "2025-08-07" as const;
export const CHAT_AZURE_DEPLOYMENT_TYPE = "GlobalStandard" as const;
export const CHAT_AZURE_UPGRADE_POLICY = "NoAutoUpgrade" as const;
export const CHAT_AZURE_GUARDRAIL = "Microsoft.DefaultV2" as const;

export type ChatAzureServerConfig = Readonly<{
  origin: `https://${typeof CHAT_AZURE_APPROVED_HOSTNAME}`;
  apiKey: string;
  deployment: typeof CHAT_AZURE_DEPLOYMENT;
  routeFamily: typeof CHAT_AZURE_ROUTE_FAMILY;
}>;

export function readChatAzureServerConfig(environment: Readonly<Record<string, string | undefined>>):
  | { ok: true; config: ChatAzureServerConfig }
  | { ok: false; code: string } {
  if (environment.LUMIS_CHAT_AI_ENABLED !== "true") return { ok: false, code: "CHAT_AI_DISABLED" };
  const apiKey = environment.LUMIS_CHAT_AZURE_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" };
  return {
    ok: true,
    config: Object.freeze({
      origin: `https://${CHAT_AZURE_APPROVED_HOSTNAME}`,
      apiKey,
      deployment: CHAT_AZURE_DEPLOYMENT,
      routeFamily: CHAT_AZURE_ROUTE_FAMILY,
    }),
  };
}

export function createAzureChatSyntheticAdapter(config: ChatAzureServerConfig, fetchImpl: typeof fetch = fetch): ChatSyntheticAdapter {
  if (config.origin !== `https://${CHAT_AZURE_APPROVED_HOSTNAME}` ||
      config.deployment !== CHAT_AZURE_DEPLOYMENT || config.routeFamily !== CHAT_AZURE_ROUTE_FAMILY) {
    throw new Error("CHAT_SYNTHETIC_AZURE_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async complete(input): Promise<ProviderResult> {
      if (input.providerAlias !== config.deployment || input.safetyProfile !== "DefaultV2") return { kind: "forbidden" };
      const remainingMs = input.deadlineAtMs - Date.now();
      if (remainingMs <= 0) return { kind: "timeout" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remainingMs);
      try {
        const response = await fetchImpl(`${config.origin}/openai/${config.routeFamily}/responses`, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            model: config.deployment,
            input: input.promptInput,
            max_output_tokens: input.maxOutputTokens,
            store: false,
          }),
          signal: controller.signal,
        });
        if (response.status === 401) return { kind: "unauthorized" };
        if (response.status === 403) return { kind: "forbidden" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        const value = await response.json().catch(() => null) as null | Record<string, unknown>;
        const filter = contentFilter(value);
        if (filter) return filter;
        if (!response.ok) return { kind: "malformed" };
        const assistantMessage = extractAssistantMessage(value);
        return assistantMessage ? { kind: "completed", assistantMessage } : { kind: "malformed" };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

function contentFilter(value: Record<string, unknown> | null): ProviderResult | null {
  if (!value) return null;
  if (isRecord(value.error) && value.error.code === "content_filter") return { kind: "content_filter_block" };
  if (value.status === "incomplete" && isRecord(value.incomplete_details) && value.incomplete_details.reason === "content_filter") {
    return { kind: "content_filter_partial" };
  }
  return null;
}

function extractAssistantMessage(value: Record<string, unknown> | null): string | null {
  if (value && typeof value.output_text === "string" && value.output_text.trim()) return value.output_text;
  if (!value || !Array.isArray(value.output)) return null;
  for (const item of value.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === "output_text" && typeof content.text === "string" && content.text.trim()) return content.text;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
