/**
 * v5 Azure adapter — generic strict-Structured-Outputs invoke for both stages of
 * the v5 two-stage router (technical identity for "Dice AI Interpretation Prompt
 * v3"). Separate from the sealed v3 adapter and from the retired v4 adapter so the
 * deployed v3 path stays untouched. Same reviewed deployment identity
 * (lumis-ai-chat-stg / gpt-5-mini / 2025-08-07, Responses v1, DefaultV2) as v1/v4.
 * The per-stage strict JSON schemas come from the v5 contract
 * (diceV05Stage1Schema / buildStage2Schema); this module only transports them.
 */
import { DICE_AZURE_DEPLOYMENT, DICE_AZURE_HOSTNAME, type DiceAzureServerConfig } from "./azure-dice-adapter-v1.ts";
import type { DiceV05ProviderAdapter, DiceV05ProviderResult } from "./dice-v0-5-window.ts";

export type DiceV05InvokeInput = Readonly<{
  prompt: string;
  deadline_at_ms: number;
  max_output_tokens: number;
  schema_name: string;
  schema: unknown;
  signal: AbortSignal;
}>;

export function createDiceV05Adapter(config: DiceAzureServerConfig, fetchImpl: typeof fetch = fetch): DiceV05ProviderAdapter {
  if (config.endpoint !== `https://${DICE_AZURE_HOSTNAME}` || config.deployment !== DICE_AZURE_DEPLOYMENT || config.routeFamily !== "v1") {
    throw new Error("DICE_AZURE_PROTOCOL_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async invoke(input): Promise<DiceV05ProviderResult> {
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
        if (response.status === 429) return { kind: "server" };
        if (response.status >= 500) return { kind: "server" };
        const body = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok) return { kind: "malformed" };
        if (isContentFiltered(body)) return { kind: "content_filter" };
        if (body?.status === "incomplete") return { kind: "malformed" };
        const content = assistantText(body);
        if (content === null) return { kind: "malformed" };
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
  return (body as { status?: unknown }).status === "content_filter";
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
