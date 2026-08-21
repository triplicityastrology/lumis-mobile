// Lab-local Azure Responses API adapter (server-side only).
//
// Corrects the request/parser boundary that made a REAL staging response come back as
// CHAT_SYNTHETIC_MALFORMED. The shared mobile-chat adapter (azure-chat-synthetic-adapter-v1.ts)
// collapses several distinct real-world Responses API outcomes into a single "malformed" kind:
// in particular a reasoning model (gpt-5-mini) can return HTTP 200 with status "incomplete"
// (e.g. the output-token budget spent on reasoning) or a completed response whose output carries
// no usable text — both of which are NOT schema rejections. This adapter distinguishes them.
//
// Compared against the accepted working Dice Responses boundary (lumis-ai-provider.ts): that
// adapter separates a developer instruction from the user turn and reads the message content,
// treating an absent reply as a soft "provider_failed" (fallback) rather than a hard error. This
// adapter mirrors that discipline on the Responses API surface: a completed-but-empty / non-text /
// incomplete outcome degrades to a graceful fallback, while only a genuine non-success HTTP status
// or an unparseable/invalid body is a hard rejection.
//
// Preserved exactly: /openai/v1/responses, the approved deployment, the server-side api-key, the
// deadline/abort timeout, the one-retry discipline (owned by the caller), DefaultV2 gating, and
// extraction of BOTH top-level `output_text` and `output[].content[].text`.
//
// Metadata discipline: the only thing this adapter surfaces beyond the assistant text is a bare
// `provider_disposition` enum string. It never retains or exposes response bodies, raw text,
// headers, URLs, keys, or Azure identifiers, and it logs nothing.

import type { ChatSyntheticAdapter, ProviderResult } from "../../../supabase/functions/_shared/chat-synthetic-gateway-v1.ts";
import {
  CHAT_AZURE_APPROVED_HOSTNAME, CHAT_AZURE_DEPLOYMENT,
  type ChatAzureServerConfig,
} from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";

// Metadata-only internal disposition of a received Azure Responses API response. Closed set.
// `content_filtered` and `incomplete_truncated` are split so the founder can tell a real safety-shield
// hit apart from the reasoning model simply running out of output budget.
export type ProviderDisposition =
  | "http_or_schema_rejected"       // non-success HTTP status, or an unparseable / invalid-schema body
  | "content_filtered"              // content-filter block/partial (the safety shield fired)
  | "incomplete_truncated"          // status "incomplete" for a non-filter reason (e.g. output budget)
  | "completed_empty_output"        // completed, but no output items at all
  | "completed_non_text_output"     // completed, output items present but no usable text item
  | "completed_text";               // completed with valid, non-empty text

export type LabProviderResult = ProviderResult & { provider_disposition?: ProviderDisposition };

// Total Responses-API output budget (reasoning + visible text) for the reasoning model. The frozen
// per-call output cap (input.maxOutputTokens, ~300) is far too small for gpt-5-mini to reason AND
// reply — especially against the larger layered prompt — so we floor the wire budget generously here;
// the assistant text itself is still normalised/bounded downstream.
const LAB_LIVE_OUTPUT_TOKEN_BUDGET = 4000;

export type LabAzureResponsesAdapter = {
  complete(input: Parameters<ChatSyntheticAdapter["complete"]>[0]): Promise<LabProviderResult>;
};

function withDisposition(result: ProviderResult, disposition: ProviderDisposition): LabProviderResult {
  return { ...result, provider_disposition: disposition };
}

export function createLabAzureResponsesAdapter(
  config: ChatAzureServerConfig,
  fetchImpl: typeof fetch = fetch,
  nowMs: () => number = Date.now,
): LabAzureResponsesAdapter {
  if (config.origin !== `https://${CHAT_AZURE_APPROVED_HOSTNAME}` ||
      config.deployment !== CHAT_AZURE_DEPLOYMENT || config.routeFamily !== "v1") {
    throw new Error("CHAT_SYNTHETIC_AZURE_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async complete(input): Promise<LabProviderResult> {
      // Transport-level guards (no response body yet -> no disposition).
      if (input.providerAlias !== config.deployment || input.safetyProfile !== "DefaultV2") return { kind: "forbidden" };
      const remainingMs = input.deadlineAtMs - nowMs();
      if (remainingMs <= 0) return { kind: "timeout" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remainingMs);
      try {
        // Preserved request: /openai/v1/responses, deployment as model, server-side key,
        // max_output_tokens cap, store:false. (Same fields as the shared adapter.)
        const response = await fetchImpl(`${config.origin}/openai/${config.routeFamily}/responses`, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            model: config.deployment,
            input: input.promptInput,
            // gpt-5-mini is a REASONING model: max_output_tokens is the TOTAL budget (reasoning +
            // visible output). With only ~300 the model spends it all on reasoning and returns no
            // text (status "incomplete"). Use minimal reasoning effort and a budget large enough
            // for a full companion reply so real text comes back.
            max_output_tokens: Math.max(input.maxOutputTokens, LAB_LIVE_OUTPUT_TOKEN_BUDGET),
            reasoning: { effort: "minimal" },
            store: false,
          }),
          signal: controller.signal,
        });
        // HTTP status classes handled before any body parse (no disposition — transport level).
        if (response.status === 401) return { kind: "unauthorized" };
        if (response.status === 403) return { kind: "forbidden" };
        if (response.status === 429) return { kind: "rate_limited" };
        if (response.status >= 500) return { kind: "server_error" };

        const value = (await response.json().catch(() => null)) as null | Record<string, unknown>;
        const status = value && typeof value.status === "string" ? value.status : undefined;

        // (2) content filter — either an error object or an incomplete/content_filter reason.
        if (isRecord(value?.error) && value!.error.code === "content_filter") {
          return withDisposition({ kind: "content_filter_block" }, "content_filtered");
        }
        if (status === "incomplete" && isRecord(value?.incomplete_details) && value!.incomplete_details.reason === "content_filter") {
          return withDisposition({ kind: "content_filter_partial" }, "content_filtered");
        }

        // (1) non-success HTTP or unparseable/invalid body -> hard schema rejection.
        if (!response.ok || !value) return withDisposition({ kind: "malformed" }, "http_or_schema_rejected");

        // (2) incomplete for a non-filter reason (e.g. output budget spent on reasoning): the
        // provider responded but did not finish -> graceful fallback, NOT a schema rejection.
        if (status === "incomplete") return withDisposition({ kind: "server_error" }, "incomplete_truncated");

        // (5) completed with valid text (both extraction paths preserved).
        const message = extractAssistantMessage(value);
        if (message) return withDisposition({ kind: "completed", assistantMessage: message }, "completed_text");

        // (3)/(4) completed but no usable text: distinguish empty vs non-text output.
        const hasOutputItems = Array.isArray(value.output) && value.output.length > 0;
        return withDisposition({ kind: "server_error" }, hasOutputItems ? "completed_non_text_output" : "completed_empty_output");
      } catch (error) {
        return error instanceof DOMException && error.name === "AbortError" ? { kind: "timeout" } : { kind: "network" };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

// Preserved extraction: top-level `output_text`, then `output[].content[].text` (type output_text).
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
