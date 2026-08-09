import type { ChatSyntheticAdapter, ProviderResult } from "./chat-synthetic-gateway-v1.ts";

type ServerConfig = {
  endpoint: string;
  apiKey: string;
  providerAlias: "lumis-ai-chat-stg";
};

export function createAzureChatSyntheticAdapter(config: ServerConfig): ChatSyntheticAdapter {
  return {
    async complete(input): Promise<ProviderResult> {
      const remainingMs = input.deadlineAtMs - Date.now();
      if (remainingMs <= 0) return { kind: "timeout" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remainingMs);
      try {
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            provider_alias: config.providerAlias,
            prompt_template_version: input.promptVersion,
            language: input.language,
            synthetic_prompt_input: input.promptInput,
            max_output_tokens: input.maxOutputTokens,
            safety_profile: input.safetyProfile
          }),
          signal: controller.signal
        });
        if (response.status === 401) return { kind: "unauthorized" };
        if (response.status === 403) return { kind: "forbidden" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        if (!response.ok) return { kind: "malformed" };
        const value = await response.json().catch(() => null) as null | Record<string, unknown>;
        if (value?.result === "content_filter_block") return { kind: "content_filter_block" };
        if (value?.result === "content_filter_partial") return { kind: "content_filter_partial" };
        if (value?.result !== "completed" || typeof value.assistant_message !== "string" || !Number.isInteger(value.output_tokens)) {
          return { kind: "malformed" };
        }
        return { kind: "completed", assistantMessage: value.assistant_message, outputTokens: value.output_tokens as number };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
