import {
  DICE_AZURE_DEPLOYMENT_FAMILY,
  DICE_AZURE_SERVER_ALIAS,
  type DiceAzureAdapter,
  type DiceProviderResult
} from "./dice-synthetic-gateway-v0-3.ts";
import type { DiceSyntheticLanguage } from "./dice-synthetic-registry-v0-3.ts";

export type DiceAzureServerConfig = Readonly<{
  enabled: true;
  providerAlias: typeof DICE_AZURE_SERVER_ALIAS;
  deploymentFamily: typeof DICE_AZURE_DEPLOYMENT_FAMILY;
  endpoint: string;
  apiKey: string;
  apiVersion: string;
}>;

export type ServerEnvironment = Readonly<Record<string, string | undefined>>;

export function readDiceAzureServerConfig(environment: ServerEnvironment):
  | { ok: true; config: DiceAzureServerConfig }
  | { ok: false; code: string } {
  if (environment.LUMIS_AI_ENABLED !== "true") return { ok: false, code: "DICE_AI_DISABLED" };
  if (environment.LUMIS_AI_PROVIDER_ALIAS !== DICE_AZURE_SERVER_ALIAS) return { ok: false, code: "DICE_PROVIDER_ALIAS_INVALID" };
  if (environment.LUMIS_AI_DEPLOYMENT_FAMILY !== DICE_AZURE_DEPLOYMENT_FAMILY) return { ok: false, code: "DICE_DEPLOYMENT_FAMILY_INVALID" };
  const endpoint = environment.AZURE_OPENAI_ENDPOINT;
  const apiKey = environment.AZURE_OPENAI_API_KEY;
  const apiVersion = environment.AZURE_OPENAI_API_VERSION;
  if (!endpoint || !apiKey || !apiVersion) return { ok: false, code: "DICE_PROVIDER_CONFIGURATION_MISSING" };
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { ok: false, code: "DICE_PROVIDER_CONFIGURATION_INVALID" };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { ok: false, code: "DICE_PROVIDER_CONFIGURATION_INVALID" };
  }
  return { ok: true, config: { enabled: true, providerAlias: DICE_AZURE_SERVER_ALIAS, deploymentFamily: DICE_AZURE_DEPLOYMENT_FAMILY, endpoint: parsed.origin, apiKey, apiVersion } };
}

export function createAzureDiceAdapter(config: DiceAzureServerConfig, fetchImpl: typeof fetch = fetch): DiceAzureAdapter {
  return Object.freeze({
    async invoke(input: Readonly<{
      providerAlias: typeof DICE_AZURE_SERVER_ALIAS;
      promptVersion: "dice_v0_3_synthetic_prompt_2026_08_09";
      prompt: string;
      language: DiceSyntheticLanguage;
      deadlineAtMs: number;
      maxOutputTokens: 300;
    }>): Promise<DiceProviderResult> {
      if (input.providerAlias !== config.providerAlias) return { kind: "permission" };
      const remaining = input.deadlineAtMs - Date.now();
      if (remaining <= 0) return { kind: "timeout" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);
      try {
        const deployment = encodeURIComponent(config.providerAlias);
        const response = await fetchImpl(`${config.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: input.prompt }],
            max_completion_tokens: input.maxOutputTokens,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        });
        if (response.status === 401) return { kind: "authentication" };
        if (response.status === 403) return { kind: "permission" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        if (!response.ok) return { kind: "invalid_output" };
        const body = await response.json().catch(() => null) as Record<string, unknown> | null;
        const filter = extractFilterDisposition(body);
        if (filter) return { kind: filter };
        const content = extractAssistantContent(body);
        if (!content) return { kind: "invalid_output" };
        const parsed = JSON.parse(content) as unknown;
        return { kind: "success", output: parsed };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      } finally {
        clearTimeout(timer);
      }
    }
  });
}

function extractFilterDisposition(body: Record<string, unknown> | null): "content_filter_block" | "content_filter_partial" | null {
  if (!body) return null;
  if (body.error && typeof body.error === "object" && (body.error as Record<string, unknown>).code === "content_filter") return "content_filter_block";
  const choice = Array.isArray(body.choices) ? body.choices[0] : null;
  if (choice && typeof choice === "object" && (choice as Record<string, unknown>).finish_reason === "content_filter") return "content_filter_partial";
  return null;
}

function extractAssistantContent(body: Record<string, unknown> | null): string | null {
  const choice = body && Array.isArray(body.choices) ? body.choices[0] : null;
  if (!choice || typeof choice !== "object") return null;
  const message = (choice as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}
