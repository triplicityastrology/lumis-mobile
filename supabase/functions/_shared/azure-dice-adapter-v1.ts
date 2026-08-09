import type { DiceLanguage } from "./dice-synthetic-canonical-v1.ts";
import type { DiceProviderAdapter, DiceProviderResult } from "./dice-synthetic-gateway-port-v1.ts";

export const DICE_AZURE_API_VERSION = "2024-10-21" as const;
export const DICE_AZURE_DEPLOYMENT = "lumis-ai-chat-stg" as const;

export type DiceAzureServerConfig = Readonly<{
  endpoint: string;
  apiKey: string;
  deployment: typeof DICE_AZURE_DEPLOYMENT;
  apiVersion: typeof DICE_AZURE_API_VERSION;
}>;

export type ServerEnvironment = Readonly<Record<string, string | undefined>>;

export function readDiceAzureServerConfig(environment: ServerEnvironment):
  | { ok: true; config: DiceAzureServerConfig }
  | { ok: false; code: string } {
  if (environment.LUMIS_DICE_AI_ENABLED !== "true") return { ok: false, code: "DICE_AI_DISABLED" };
  const endpoint = environment.LUMIS_DICE_AZURE_ENDPOINT;
  const apiKey = environment.LUMIS_DICE_AZURE_API_KEY;
  const allowListValue = environment.LUMIS_DICE_AZURE_ALLOWED_HOSTNAMES;
  if (!endpoint || !apiKey || !allowListValue) return { ok: false, code: "DICE_PROVIDER_CONFIGURATION_MISSING" };
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { return { ok: false, code: "DICE_PROVIDER_ENDPOINT_INVALID" }; }
  const allowList = allowListValue.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      !isAzureOpenAiHostname(parsed.hostname) || allowList.length === 0 || allowList.some((host) => !isAzureOpenAiHostname(host)) ||
      !allowList.includes(parsed.hostname.toLowerCase())) {
    return { ok: false, code: "DICE_PROVIDER_ENDPOINT_NOT_ALLOWED" };
  }
  return {
    ok: true,
    config: Object.freeze({
      endpoint: parsed.origin,
      apiKey,
      deployment: DICE_AZURE_DEPLOYMENT,
      apiVersion: DICE_AZURE_API_VERSION,
    }),
  };
}

export function createAzureDiceAdapter(config: DiceAzureServerConfig, fetchImpl: typeof fetch = fetch): DiceProviderAdapter {
  return Object.freeze({
    async invoke(input: Readonly<{ prompt: string; prompt_version: "lumis_dice_synthetic_prompt_v1"; language: DiceLanguage; deadline_at_ms: number; max_output_tokens: 300; signal: AbortSignal }>): Promise<DiceProviderResult> {
      const remaining = input.deadline_at_ms - Date.now();
      if (remaining <= 0) return { kind: "timeout" };
      try {
        const url = `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${DICE_AZURE_API_VERSION}`;
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: input.prompt }],
            max_completion_tokens: input.max_output_tokens,
            response_format: { type: "json_object" },
          }),
          signal: input.signal,
        });
        if (response.status === 401) return { kind: "authentication" };
        if (response.status === 403) return { kind: "permission" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        const body = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok) return contentFilter(body) ?? { kind: "invalid_output" };
        const filtered = contentFilter(body);
        if (filtered) return filtered;
        const content = assistantContent(body);
        return content === null ? { kind: "invalid_output" } : { kind: "success", content };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      }
    },
  });
}

function isAzureOpenAiHostname(hostname: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.openai\.azure\.com$/u.test(hostname.toLowerCase());
}

function contentFilter(body: Record<string, unknown> | null): DiceProviderResult | null {
  if (!body) return null;
  if (isRecord(body.error) && body.error.code === "content_filter") return { kind: "content_filter_block" };
  const choice = Array.isArray(body.choices) ? body.choices[0] : null;
  if (isRecord(choice) && choice.finish_reason === "content_filter") return { kind: "content_filter_partial" };
  return null;
}

function assistantContent(body: Record<string, unknown> | null): string | null {
  const choice = body && Array.isArray(body.choices) ? body.choices[0] : null;
  const message = isRecord(choice) ? choice.message : null;
  return isRecord(message) && typeof message.content === "string" ? message.content : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
