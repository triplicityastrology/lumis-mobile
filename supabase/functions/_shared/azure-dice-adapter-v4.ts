/**
 * v4 Azure adapter — a generic strict-Structured-Outputs invoke used by both
 * stages of the two-stage router. Separate from the v3 adapter so the sealed,
 * deployed v3 path is untouched. Same reviewed deployment identity
 * (lumis-ai-chat-stg / gpt-5-mini / 2025-08-07, Responses v1, DefaultV2).
 */
import { DICE_AZURE_DEPLOYMENT, DICE_AZURE_HOSTNAME, type DiceAzureServerConfig } from "./azure-dice-adapter-v1.ts";
import {
  DICE_V04_JUDGMENT_CODES,
  DICE_V04_MODES,
  DICE_V04_MODE_SELECTION_SCHEMA,
  DICE_V04_RESULT_SCHEMA,
  DICE_V04_ROUTE_REVIEW_STATUS,
  type DiceV04Language,
  type DiceV04QuestionMode,
} from "./dice-v0-4-interpretation-contract.ts";

export type DiceV04ProviderResult =
  | Readonly<{ kind: "success"; content: string }>
  | Readonly<{ kind: "timeout" | "network" | "rate_limited" | "server_error" | "authentication" | "permission" | "content_filter" | "invalid_output" }>;

export type DiceV04InvokeInput = Readonly<{
  prompt: string;
  deadline_at_ms: number;
  max_output_tokens: 300 | 600;
  schema_name: string;
  schema: unknown;
  signal: AbortSignal;
}>;

export interface DiceV04ProviderAdapter {
  invoke(input: DiceV04InvokeInput): Promise<DiceV04ProviderResult>;
}

const nullable = (base: Record<string, unknown>) => Object.freeze({ anyOf: [base, { type: "null" }] });

export function diceV04ModeSelectionJsonSchema() {
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["selection"],
    properties: Object.freeze({
      selection: Object.freeze({ type: "string", enum: [...DICE_V04_MODES, DICE_V04_ROUTE_REVIEW_STATUS] }),
    }),
    // schema name is carried separately; kept here for provenance
    title: DICE_V04_MODE_SELECTION_SCHEMA,
  } as const);
}

// Strict interpretation schema: all keys required; mode-inapplicable content is
// null (nullable via anyOf under a property, which strict mode supports).
export function diceV04InterpretationJsonSchema(mode: DiceV04QuestionMode, language: DiceV04Language) {
  const str = Object.freeze({ type: "string", minLength: 1 });
  const nstr = nullable({ type: "string", minLength: 1 });
  const isJudgment = mode === "judgment";
  const isTiming = mode === "timing";
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["schema", "status", "language", "question_mode", "planet_layer", "sign_layer", "house_layer", "synthesis", "judgment_code", "judgment_summary", "timing_summary", "watch_out", "practical_step", "suggested_followups"],
    properties: Object.freeze({
      schema: Object.freeze({ type: "string", const: DICE_V04_RESULT_SCHEMA }),
      status: Object.freeze({ type: "string", enum: ["completed", DICE_V04_ROUTE_REVIEW_STATUS] }),
      language: Object.freeze({ type: "string", const: language }),
      question_mode: Object.freeze({ type: "string", const: mode }),
      planet_layer: nstr,
      sign_layer: nstr,
      house_layer: nstr,
      synthesis: nstr,
      judgment_code: isJudgment ? Object.freeze({ type: "string", enum: [...DICE_V04_JUDGMENT_CODES] }) : Object.freeze({ type: "null" }),
      judgment_summary: isJudgment ? nstr : Object.freeze({ type: "null" }),
      timing_summary: isTiming ? nstr : Object.freeze({ type: "null" }),
      watch_out: nstr,
      practical_step: isJudgment ? Object.freeze({ type: "null" }) : nstr,
      suggested_followups: Object.freeze({ type: "array", items: str, maxItems: 3 }),
    }),
  } as const);
}

export function createDiceV04Adapter(config: DiceAzureServerConfig, fetchImpl: typeof fetch = fetch): DiceV04ProviderAdapter {
  if (config.endpoint !== `https://${DICE_AZURE_HOSTNAME}` || config.deployment !== DICE_AZURE_DEPLOYMENT || config.routeFamily !== "v1") {
    throw new Error("DICE_AZURE_PROTOCOL_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async invoke(input: DiceV04InvokeInput): Promise<DiceV04ProviderResult> {
      if (input.deadline_at_ms - Date.now() <= 0) return { kind: "timeout" };
      try {
        const response = await fetchImpl(`${config.endpoint}/openai/${config.routeFamily}/responses`, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            model: config.deployment,
            input: input.prompt,
            max_output_tokens: input.max_output_tokens,
            reasoning: { effort: "minimal" },
            store: false,
            text: { verbosity: "low", format: { type: "json_schema", name: input.schema_name, strict: true, schema: input.schema } },
          }),
          signal: input.signal,
        });
        if (response.status === 401) return { kind: "authentication" };
        if (response.status === 403) return { kind: "permission" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };
        const body = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok) return { kind: "invalid_output" };
        if (isContentFiltered(body)) return { kind: "content_filter" };
        if (body?.status === "incomplete") return { kind: "invalid_output" };
        const content = assistantText(body);
        if (content === null) return { kind: "invalid_output" };
        return { kind: "success", content };
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      }
    },
  });
}

function isContentFiltered(body: Record<string, unknown> | null): boolean {
  if (!body) return false;
  const details = (body as { incomplete_details?: { reason?: unknown } }).incomplete_details;
  if (details?.reason === "content_filter") return true;
  const status = (body as { status?: unknown }).status;
  return status === "content_filter";
}

function assistantText(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  if (typeof (body as { output_text?: unknown }).output_text === "string") return (body as { output_text: string }).output_text;
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if ((part as { type?: unknown })?.type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}
