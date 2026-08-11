import type { DiceLanguage } from "./dice-synthetic-canonical-v1.ts";
import type { DiceProviderAdapter, DiceProviderResult } from "./dice-synthetic-gateway-port-v1.ts";

export const DICE_AZURE_API_VERSION = null;
export const DICE_AZURE_ROUTE_FAMILY = "v1" as const;
export const DICE_AZURE_DEPLOYMENT = "lumis-ai-chat-stg" as const;
export const DICE_AZURE_HOSTNAME = "lumis-foundry-stg-sea-20260731.services.ai.azure.com" as const;
export const DICE_AZURE_MODEL = "gpt-5-mini" as const;
export const DICE_AZURE_MODEL_VERSION = "2025-08-07" as const;
export const DICE_AZURE_DEPLOYMENT_TYPE = "GlobalStandard" as const;
export const DICE_AZURE_UPGRADE_POLICY = "NoAutoUpgrade" as const;
export const DICE_AZURE_GUARDRAIL = "Microsoft.DefaultV2" as const;
export const DICE_AZURE_LIMITS = Object.freeze({ tokensPerMinute: 10_000, requestsPerMinute: 10 });
export const DICE_AZURE_AUTHORITY = Object.freeze({
  deployment_alias: DICE_AZURE_DEPLOYMENT,
  model: DICE_AZURE_MODEL,
  model_version: DICE_AZURE_MODEL_VERSION,
  deployment_type: DICE_AZURE_DEPLOYMENT_TYPE,
  model_version_upgrade_policy: DICE_AZURE_UPGRADE_POLICY,
  guardrail: DICE_AZURE_GUARDRAIL,
  tokens_per_minute_limit: DICE_AZURE_LIMITS.tokensPerMinute,
  requests_per_minute_limit: DICE_AZURE_LIMITS.requestsPerMinute,
  foundry_service_hostname: DICE_AZURE_HOSTNAME,
  transport: "https",
  api_route_family: DICE_AZURE_ROUTE_FAMILY,
});

export type DiceAzureServerConfig = Readonly<{
  endpoint: string;
  apiKey: string;
  deployment: typeof DICE_AZURE_DEPLOYMENT;
  routeFamily: typeof DICE_AZURE_ROUTE_FAMILY;
}>;

export type ServerEnvironment = Readonly<Record<string, string | undefined>>;

export function readDiceAzureServerConfig(environment: ServerEnvironment):
  | { ok: true; config: DiceAzureServerConfig }
  | { ok: false; code: string; authority?: typeof DICE_AZURE_AUTHORITY } {
  if (environment.LUMIS_DICE_AI_ENABLED !== "true") return { ok: false, code: "DICE_AI_DISABLED" };
  const exactNames = environment.LUMIS_DICE_DEPLOYMENT_ALIAS === DICE_AZURE_DEPLOYMENT &&
    environment.LUMIS_DICE_MODEL === DICE_AZURE_MODEL &&
    environment.LUMIS_DICE_MODEL_VERSION === DICE_AZURE_MODEL_VERSION &&
    environment.LUMIS_DICE_DEPLOYMENT_TYPE === DICE_AZURE_DEPLOYMENT_TYPE &&
    environment.LUMIS_DICE_UPGRADE_POLICY === DICE_AZURE_UPGRADE_POLICY &&
    environment.LUMIS_DICE_GUARDRAIL === DICE_AZURE_GUARDRAIL &&
    environment.LUMIS_DICE_TPM_LIMIT === String(DICE_AZURE_LIMITS.tokensPerMinute) &&
    environment.LUMIS_DICE_RPM_LIMIT === String(DICE_AZURE_LIMITS.requestsPerMinute) &&
    environment.LUMIS_DICE_FOUNDRY_HOSTNAME === DICE_AZURE_HOSTNAME &&
    environment.LUMIS_DICE_FOUNDRY_PROTOCOL === "https" &&
    environment.LUMIS_DICE_API_ROUTE_FAMILY === DICE_AZURE_ROUTE_FAMILY;
  if (!exactNames || environment.LUMIS_DICE_AZURE_API_VERSION !== undefined) {
    return { ok: false, code: "DICE_PROVIDER_AUTHORITY_INVALID" };
  }
  if (environment.LUMIS_DICE_TRAFFIC_AUTHORIZED !== "true") {
    return { ok: false, code: "DICE_AZURE_TRAFFIC_AUTHORITY_MISSING", authority: DICE_AZURE_AUTHORITY };
  }
  const apiKey = environment.LUMIS_DICE_AZURE_API_KEY?.trim();
  if (!apiKey) return { ok: false, code: "DICE_AZURE_CONFIGURATION_INVALID" };
  return {
    ok: true,
    config: {
      endpoint: `https://${DICE_AZURE_HOSTNAME}`,
      apiKey,
      deployment: DICE_AZURE_DEPLOYMENT,
      routeFamily: DICE_AZURE_ROUTE_FAMILY,
    },
  };
}

export function createAzureDiceAdapter(config: DiceAzureServerConfig, fetchImpl: typeof fetch = fetch): DiceProviderAdapter {
  if (config.endpoint !== `https://${DICE_AZURE_HOSTNAME}` || config.deployment !== DICE_AZURE_DEPLOYMENT || config.routeFamily !== "v1") {
    throw new Error("DICE_AZURE_PROTOCOL_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async invoke(input: Readonly<{ prompt: string; prompt_version: "lumis_dice_synthetic_prompt_v1"; language: DiceLanguage; deadline_at_ms: number; max_output_tokens: 300; signal: AbortSignal }>): Promise<DiceProviderResult> {
      const remaining = input.deadline_at_ms - Date.now();
      if (remaining <= 0) return { kind: "timeout" };
      try {
        const url = `${config.endpoint}/openai/${config.routeFamily}/responses`;
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            model: config.deployment,
            input: input.prompt,
            max_output_tokens: input.max_output_tokens,
            store: false,
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

function contentFilter(body: Record<string, unknown> | null): DiceProviderResult | null {
  if (!body) return null;
  if (isRecord(body.error) && body.error.code === "content_filter") return { kind: "content_filter_block" };
  const choice = Array.isArray(body.choices) ? body.choices[0] : null;
  if (body.status === "incomplete" && isRecord(body.incomplete_details) && body.incomplete_details.reason === "content_filter") return { kind: "content_filter_partial" };
  if (isRecord(choice) && choice.finish_reason === "content_filter") return { kind: "content_filter_partial" };
  return null;
}

function assistantContent(body: Record<string, unknown> | null): string | null {
  if (body && typeof body.output_text === "string") return body.output_text;
  const choice = body && Array.isArray(body.choices) ? body.choices[0] : null;
  const message = isRecord(choice) ? choice.message : null;
  return isRecord(message) && typeof message.content === "string" ? message.content : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
