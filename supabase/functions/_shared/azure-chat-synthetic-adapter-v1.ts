import type { ChatSyntheticAdapter, ProviderResult } from "./chat-synthetic-gateway-v1.ts";

export const CHAT_AZURE_APPROVED_HOSTNAME = "lumis-ai-chat-stg.openai.azure.com" as const;
export const CHAT_AZURE_APPROVED_API_VERSION = "2024-10-21" as const;

export type ChatAzureServerConfig = Readonly<{
  endpoint: `https://${typeof CHAT_AZURE_APPROVED_HOSTNAME}`;
  apiKey: string;
  apiVersion: typeof CHAT_AZURE_APPROVED_API_VERSION;
  providerAlias: "lumis-ai-chat-stg";
}>;

export function readChatAzureServerConfig(environment: Readonly<Record<string, string | undefined>>):
  | { ok: true; config: ChatAzureServerConfig }
  | { ok: false; code: string } {
  if (environment.LUMIS_AI_ENABLED !== "true") return { ok: false, code: "CHAT_SYNTHETIC_PROVIDER_DISABLED" };
  if (environment.LUMIS_AI_PROVIDER_ALIAS !== "lumis-ai-chat-stg") return { ok: false, code: "CHAT_SYNTHETIC_PROVIDER_ALIAS_INVALID" };
  if (environment.AZURE_OPENAI_API_VERSION !== CHAT_AZURE_APPROVED_API_VERSION) return { ok: false, code: "CHAT_SYNTHETIC_API_VERSION_INVALID" };
  if (!environment.AZURE_OPENAI_API_KEY) return { ok: false, code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" };
  let endpoint: URL;
  try {
    endpoint = new URL(environment.AZURE_OPENAI_ENDPOINT ?? "");
  } catch {
    return { ok: false, code: "CHAT_SYNTHETIC_ENDPOINT_INVALID" };
  }
  if (
    endpoint.protocol !== "https:" || endpoint.hostname !== CHAT_AZURE_APPROVED_HOSTNAME ||
    endpoint.port || endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash
  ) return { ok: false, code: "CHAT_SYNTHETIC_ENDPOINT_INVALID" };
  return {
    ok: true,
    config: Object.freeze({
      endpoint: `https://${CHAT_AZURE_APPROVED_HOSTNAME}`,
      apiKey: environment.AZURE_OPENAI_API_KEY,
      apiVersion: CHAT_AZURE_APPROVED_API_VERSION,
      providerAlias: "lumis-ai-chat-stg"
    })
  };
}

export function createAzureChatSyntheticAdapter(config: ChatAzureServerConfig, fetchImpl: typeof fetch = fetch): ChatSyntheticAdapter {
  return Object.freeze({
    async complete(input): Promise<ProviderResult> {
      if (input.providerAlias !== config.providerAlias || input.safetyProfile !== "DefaultV2") return { kind: "forbidden" };
      const remainingMs = input.deadlineAtMs - Date.now();
      if (remainingMs <= 0) return { kind: "timeout" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remainingMs);
      try {
        const deployment = encodeURIComponent(config.providerAlias);
        const url = `${config.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${config.apiVersion}`;
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: input.promptInput }],
            max_completion_tokens: input.maxOutputTokens
          }),
          signal: controller.signal
        });
        if (response.status === 401) return { kind: "unauthorized" };
        if (response.status === 403) return { kind: "forbidden" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        const value = await response.json().catch(() => null) as null | Record<string, unknown>;
        if (isFilterBlock(value)) return { kind: "content_filter_block" };
        if (isFilterPartial(value)) return { kind: "content_filter_partial" };
        if (!response.ok) return { kind: "malformed" };
        const assistantMessage = extractAssistantMessage(value);
        return assistantMessage ? { kind: "completed", assistantMessage } : { kind: "malformed" };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      } finally {
        clearTimeout(timer);
      }
    }
  });
}

function isFilterBlock(value: Record<string, unknown> | null): boolean {
  return !!value?.error && typeof value.error === "object" && (value.error as Record<string, unknown>).code === "content_filter";
}

function isFilterPartial(value: Record<string, unknown> | null): boolean {
  const choice = value && Array.isArray(value.choices) ? value.choices[0] : null;
  return !!choice && typeof choice === "object" && (choice as Record<string, unknown>).finish_reason === "content_filter";
}

function extractAssistantMessage(value: Record<string, unknown> | null): string | null {
  const choice = value && Array.isArray(value.choices) ? value.choices[0] : null;
  const message = choice && typeof choice === "object" ? (choice as Record<string, unknown>).message : null;
  const content = message && typeof message === "object" ? (message as Record<string, unknown>).content : null;
  return typeof content === "string" && content.trim() ? content : null;
}
