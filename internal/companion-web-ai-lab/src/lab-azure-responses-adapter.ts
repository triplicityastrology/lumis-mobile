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
  | "content_filtered_input"        // content-filter blocked the request (prompt)
  | "content_filtered_output"       // content-filter cut the generated reply
  | "incomplete_truncated"          // status "incomplete" for a non-filter reason (e.g. output budget)
  | "completed_empty_output"        // completed, but no output items at all
  | "completed_non_text_output"     // completed, output items present but no usable text item
  | "completed_text";               // completed with valid, non-empty text

// ---- Staging-only content-filter diagnostic (redaction-only, closed metadata) ----
// When Azure blocks the request on the content filter, the exact category is the only thing needed to
// decide prompt-wording vs Azure-policy. `summarizeAzureContentFilter` parses the error body IN MEMORY
// and returns ONLY the closed enum fields below — never the raw user message, system prompt, history,
// model output, Azure error message, headers, URL, request id, endpoint, key, token, offsets, or any
// account/member data. It is surfaced on the result ONLY when the explicit staging diagnostic flag
// LUMIS_LAB_FILTER_DIAGNOSTIC=1 is set; by default the live path is byte-identical and carries only the
// bare provider_disposition enum. The redacted summary is intended for the local Founder decision trace
// of a single controlled request and must not be persisted, exported, telemetered, or sent to a browser.
export type ContentFilterSourceType = "prompt" | "completion";
export type ContentFilterCategory =
  | "hate" | "sexual" | "violence" | "self_harm"
  | "jailbreak" | "indirect_attack"
  | "protected_material_text" | "protected_material_code"
  | "unknown";
export type ContentFilterSeverity = "safe" | "low" | "medium" | "high" | null;
export type ContentFilterCategoryHit = Readonly<{
  source_type: ContentFilterSourceType;
  category: ContentFilterCategory;
  severity: ContentFilterSeverity;
  detected: boolean | null;
  filtered: boolean;
  blocked: boolean;
}>;

export const LAB_FILTER_DIAGNOSTIC_FLAG = "LUMIS_LAB_FILTER_DIAGNOSTIC" as const;

export type LabProviderResult = ProviderResult & {
  provider_disposition?: ProviderDisposition;
  content_filter_diagnostic?: ContentFilterCategoryHit[];
};

// Total Responses-API output budget (reasoning + visible text) for the reasoning model. The frozen
// per-call output cap (input.maxOutputTokens, ~300) is far too small for gpt-5-mini to reason AND
// reply — especially against the larger layered prompt — so we floor the wire budget generously here;
// the assistant text itself is still normalised/bounded downstream.
const LAB_LIVE_OUTPUT_TOKEN_BUDGET = 4000;

// Request-scoped Azure content-filter policy id for the Companion Lab (Technical-created, staging).
// Sent ONLY on the server-side outbound Azure Responses request, so Azure applies the approved
// Lab-specific policy to this request. It is a fixed server constant — never derived from the browser
// request, never surfaced in a ProviderResult/response body, never logged, never persisted/exported.
export const LAB_AZURE_POLICY_ID = "lumis-stg-companion-lab-high-v1";
const LAB_AZURE_POLICY_HEADER = "x-policy-id";

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
          // Server-side headers only: the api-key and the fixed request-scoped policy id. Neither is
          // ever exposed to or editable from the browser.
          headers: { "api-key": config.apiKey, "content-type": "application/json", [LAB_AZURE_POLICY_HEADER]: LAB_AZURE_POLICY_ID },
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
          return attachFilterDiagnostic(withDisposition({ kind: "content_filter_block" }, "content_filtered_input"), value);
        }
        if (status === "incomplete" && isRecord(value?.incomplete_details) && value!.incomplete_details.reason === "content_filter") {
          return attachFilterDiagnostic(withDisposition({ kind: "content_filter_partial" }, "content_filtered_output"), value);
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

// Server-only: is the explicit staging content-filter diagnostic flag set? Reads the process
// environment defensively (never the browser request) and never throws.
function filterDiagnosticEnabled(): boolean {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[LAB_FILTER_DIAGNOSTIC_FLAG] === "1";
  } catch {
    return false;
  }
}

// Attach the redacted, closed content-filter summary to a filter result ONLY under the diagnostic flag.
// Off by default, so the normal Lab path is unchanged and nothing extra can reach persistence/export/UI.
function attachFilterDiagnostic(result: LabProviderResult, body: unknown): LabProviderResult {
  if (!filterDiagnosticEnabled()) return result;
  const summary = summarizeAzureContentFilter(body);
  return summary.length ? { ...result, content_filter_diagnostic: summary } : result;
}

function normalizeCategory(key: string): ContentFilterCategory {
  switch (key) {
    case "hate": case "sexual": case "violence": case "self_harm":
    case "jailbreak": case "indirect_attack":
    case "protected_material_text": case "protected_material_code":
      return key;
    default:
      return "unknown"; // fail closed — never surface an unrecognised raw category key
  }
}

function normalizeSeverity(value: unknown): ContentFilterSeverity {
  return value === "safe" || value === "low" || value === "medium" || value === "high" ? value : null;
}

function hitsFromCategoryMap(map: Record<string, unknown>, source: ContentFilterSourceType): ContentFilterCategoryHit[] {
  const hits: ContentFilterCategoryHit[] = [];
  for (const [key, raw] of Object.entries(map)) {
    if (!isRecord(raw)) continue;
    const filtered = raw.filtered === true;
    hits.push(Object.freeze({
      source_type: source,
      category: normalizeCategory(key),
      severity: normalizeSeverity(raw.severity),
      detected: typeof raw.detected === "boolean" ? raw.detected : null,
      filtered,
      blocked: filtered,
    }));
  }
  return hits;
}

function failClosed(source: ContentFilterSourceType): ContentFilterCategoryHit {
  return Object.freeze({ source_type: source, category: "unknown", severity: null, detected: null, filtered: true, blocked: true });
}

// Parse a Responses-API content-filter body into ONLY the closed summary. Supports the documented Azure
// error shapes; any content-filter signal with an unrecognised shape fails closed as category=unknown.
// No raw text/message/headers/urls/keys are read into the result.
export function summarizeAzureContentFilter(value: unknown): ContentFilterCategoryHit[] {
  if (!isRecord(value)) return [];
  const hits: ContentFilterCategoryHit[] = [];

  const err = isRecord(value.error) ? value.error : null;
  const inner = err ? (isRecord(err.innererror) ? err.innererror : isRecord(err.inner_error) ? err.inner_error : null) : null;
  if (inner) {
    const cfr = isRecord(inner.content_filter_result) ? inner.content_filter_result
      : isRecord(inner.content_filter_results) ? inner.content_filter_results : null;
    if (cfr) hits.push(...hitsFromCategoryMap(cfr, "prompt"));
  }

  // Azure prompt-side array shape: prompt_filter_results:[{ content_filter_results:{...} }].
  if (Array.isArray(value.prompt_filter_results)) {
    for (const entry of value.prompt_filter_results) {
      if (isRecord(entry) && isRecord(entry.content_filter_results)) {
        hits.push(...hitsFromCategoryMap(entry.content_filter_results, "prompt"));
      }
    }
  }

  // Top-level completion-side shapes.
  const top = isRecord(value.content_filter_results) ? value.content_filter_results
    : isRecord(value.content_filters) ? value.content_filters : null;
  if (top) hits.push(...hitsFromCategoryMap(top, "completion"));

  if (hits.length) return hits;

  // Recognised content-filter signal but no parseable category detail -> fail closed.
  if (err && err.code === "content_filter") return [failClosed("prompt")];
  if (isRecord(value.incomplete_details) && value.incomplete_details.reason === "content_filter") return [failClosed("completion")];
  return [];
}
