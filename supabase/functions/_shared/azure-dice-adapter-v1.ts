import { DICE_PROMPT_VERSION, type DiceLanguage } from "./dice-synthetic-canonical-v1.ts";
import type { DiceProviderAdapter, DiceProviderDisposition, DiceProviderResult } from "./dice-synthetic-gateway-port-v1.ts";
import {
  DICE_ROUTE_MISMATCH_CODE,
  DICE_ROUTE_MISMATCH_RESULT,
  DICE_V03_RESULT_SCHEMA,
  parseDiceV03Output,
  type DiceV03QuestionShape,
} from "./dice-v0-3-interpretation-contract.ts";

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

const RESULT_KEYS = ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "synthesis", "timing_or_pace", "judgment", "watch_out", "practical_direction"] as const;

// v3 structured output: EITHER a completed reading OR the standardized
// route-mismatch envelope (the non-overriding AI stop, handoff §6.6). Root-level
// anyOf of two closed objects — Azure strict-mode acceptance of a root anyOf
// must be reconfirmed at deploy.
export function diceResultJsonSchema(language: DiceLanguage, questionShape: DiceV03QuestionShape) {
  const layerLen = 240;
  const synthesisLen = 900;
  const conditionalLen = 320;
  const layerDesc = language === "zh-Hant" ? "一句精簡的內部證據句，以。！？結尾。" : "One compact evidence sentence ending in punctuation.";
  const synthDesc = language === "zh-Hant" ? "兩至四句書面繁體中文，將行星、星座、宮位整合為對問題的一個回答。" : "Two to four sentences integrating Planet, Sign and House into one answer to the question.";
  const condDesc = language === "zh-Hant" ? "一句具體、以。！？結尾的句子。" : "One specific sentence ending in punctuation.";
  const layer = Object.freeze({ type: "string", minLength: 1, maxLength: layerLen, description: layerDesc });
  const conditionalText = Object.freeze({ type: "string", minLength: 1, maxLength: conditionalLen, description: condDesc });
  const requiredNull = Object.freeze({ type: "null" });
  const completed = Object.freeze({
    type: "object",
    additionalProperties: false,
    required: RESULT_KEYS,
    properties: Object.freeze({
      schema: Object.freeze({ type: "string", enum: [DICE_V03_RESULT_SCHEMA] }),
      language: Object.freeze({ type: "string", const: language }),
      planet_layer: layer,
      sign_element_layer: layer,
      house_layer: layer,
      synthesis: Object.freeze({ type: "string", minLength: 1, maxLength: synthesisLen, description: synthDesc }),
      timing_or_pace: questionShape === "timing" ? conditionalText : requiredNull,
      judgment: questionShape === "judgment" ? conditionalText : requiredNull,
      watch_out: conditionalText,
      practical_direction: conditionalText,
    }),
  });
  const routeMismatch = Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["result", "code", "language"],
    properties: Object.freeze({
      result: Object.freeze({ type: "string", const: DICE_ROUTE_MISMATCH_RESULT }),
      code: Object.freeze({ type: "string", const: DICE_ROUTE_MISMATCH_CODE }),
      language: Object.freeze({ type: "string", const: language }),
    }),
  });
  return Object.freeze({ anyOf: [completed, routeMismatch] } as const);
}

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
    async invoke(input: Readonly<{ prompt: string; prompt_version: typeof DICE_PROMPT_VERSION; language: DiceLanguage; question_shape: DiceV03QuestionShape; deadline_at_ms: number; max_output_tokens: 300 | 600; signal: AbortSignal }>): Promise<DiceProviderResult> {
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
            reasoning: { effort: "minimal" },
            store: false,
            text: {
              verbosity: "low",
              format: {
                type: "json_schema",
                name: "lumis_dice_v0_3_result_v3",
                strict: true,
                schema: diceResultJsonSchema(input.language, input.question_shape),
              },
            },
          }),
          signal: input.signal,
        });
        const body = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (response.status === 401) return { kind: "authentication" };
        if (response.status === 403) return { kind: "permission" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        if (!response.ok) {
          const disposition = non2xxDisposition(response.status, body);
          return contentFilter(body, disposition) ?? { kind: "invalid_output", provider_disposition: disposition };
        }
        const filtered = contentFilter(body);
        if (filtered) return filtered;
        if (body?.status === "incomplete") {
          return { kind: "invalid_output", provider_disposition: incompleteDisposition(body) };
        }
        const content = assistantContent(body);
        if (content === null) return { kind: "invalid_output", provider_disposition: completedOutputDisposition(body) };
        if (!parseDiceV03Output(content, { language: input.language, question_shape: input.question_shape })) {
          return { kind: "invalid_output", provider_disposition: "responses_completed_schema_invalid" };
        }
        return { kind: "success", content, provider_disposition: "responses_completed_valid" };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      }
    },
  });
}

function contentFilter(body: Record<string, unknown> | null, disposition: DiceProviderDisposition = "responses_incomplete_content_filter"): DiceProviderResult | null {
  if (!body) return null;
  if (isRecord(body.error) && body.error.code === "content_filter") return { kind: "content_filter_block", provider_disposition: disposition };
  const choice = Array.isArray(body.choices) ? body.choices[0] : null;
  if (body.status === "incomplete" && isRecord(body.incomplete_details) && body.incomplete_details.reason === "content_filter") return { kind: "content_filter_partial", provider_disposition: "responses_incomplete_content_filter" };
  if (isRecord(choice) && choice.finish_reason === "content_filter") return { kind: "content_filter_partial", provider_disposition: disposition };
  return null;
}

function non2xxDisposition(status: number, body: Record<string, unknown> | null): "http_400_text_format_schema" | "http_non_2xx" {
  const error = body && isRecord(body.error) ? body.error : null;
  const code = error && typeof error.code === "string" && ["invalid_request", "invalid_request_error"].includes(error.code) ? error.code : null;
  const param = error && typeof error.param === "string" && ["text.format", "text.format.schema"].includes(error.param) ? error.param : null;
  return status === 400 && code !== null && param !== null ? "http_400_text_format_schema" : "http_non_2xx";
}

function incompleteDisposition(body: Record<string, unknown>): "responses_incomplete_content_filter" | "responses_incomplete_max_output" | "responses_incomplete_other" {
  const reason = isRecord(body.incomplete_details) && typeof body.incomplete_details.reason === "string" ? body.incomplete_details.reason : "";
  if (reason === "content_filter") return "responses_incomplete_content_filter";
  if (reason === "max_output_tokens") return "responses_incomplete_max_output";
  return "responses_incomplete_other";
}

function completedOutputDisposition(body: Record<string, unknown> | null): "responses_completed_empty_output" | "responses_completed_non_text_output" {
  if (!body || typeof body.output_text === "string" && !body.output_text.trim()) return "responses_completed_empty_output";
  if (!Array.isArray(body.output) || body.output.length === 0) return "responses_completed_empty_output";
  return "responses_completed_non_text_output";
}

function assistantContent(body: Record<string, unknown> | null): string | null {
  // `output_text` is an SDK convenience projection. The HTTP Responses v1
  // contract returns message content in output[].content[].
  if (body && typeof body.output_text === "string") return body.output_text;
  if (body && Array.isArray(body.output)) {
    const text: string[] = [];
    for (const item of body.output) {
      if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") text.push(content.text);
      }
    }
    if (text.length === 1 && text[0].trim()) return text[0];
    if (text.length > 1) return null;
  }
  const choice = body && Array.isArray(body.choices) ? body.choices[0] : null;
  const message = isRecord(choice) ? choice.message : null;
  return isRecord(message) && typeof message.content === "string" ? message.content : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
