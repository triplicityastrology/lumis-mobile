// Lab-local Azure Responses API adapter tests (finding 4).
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-azure-responses-adapter.fixtures.js
//
// Proves the corrected request/parser boundary: the preserved /openai/v1/responses request shape;
// valid text extraction via BOTH top-level output_text and output[].content[].text; and each of the
// five closed provider dispositions — including the incomplete / completed-empty / completed-non-text
// cases that previously collapsed into a spurious "malformed" (CHAT_SYNTHETIC_MALFORMED).

import test from "node:test";
import { strict as assert } from "node:assert";
import { createLabAzureResponsesAdapter } from "../src/lab-azure-responses-adapter.ts";
import { readChatAzureServerConfig } from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";

const SECRET = "SECRET_SENTINEL_KEY_DO_NOT_LEAK";
const cfg = readChatAzureServerConfig({ LUMIS_CHAT_AI_ENABLED: "true", LUMIS_CHAT_AZURE_API_KEY: SECRET });
if (!cfg.ok) throw new Error("config setup failed");
const config = cfg.config;

// A fetch stub that records the request and returns a scripted Response.
function stub(json: unknown, status = 200, rawText?: string) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (rawText !== undefined) return new Response(rawText, { status });
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const baseInput = {
  providerAlias: "lumis-ai-chat-stg" as const,
  safetyProfile: "DefaultV2" as const,
  promptVersion: "companion_synthetic_prompt_v1" as const,
  language: "en" as const,
  promptInput: "PROMPT_BODY_MARKER",
  maxOutputTokens: 300 as const,
  deadlineAtMs: Date.now() + 12_000,
};

async function run(json: unknown, status = 200, rawText?: string) {
  const s = stub(json, status, rawText);
  const adapter = createLabAzureResponsesAdapter(config, s.fn, () => Date.now());
  const result = await adapter.complete({ ...baseInput, deadlineAtMs: Date.now() + 12_000 });
  return { result: result as any, calls: s.calls };
}

// --- Request preservation: /openai/v1/responses, deployment, key, max_output_tokens, store:false ---
test("preserves the /openai/v1/responses request shape (deployment, key, token cap, store:false)", async () => {
  const { calls } = await run({ status: "completed", output_text: "hi" });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/openai/v1/responses"), calls[0].url);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["api-key"], SECRET);
  const body = JSON.parse(calls[0].init.body as string);
  assert.equal(body.model, "lumis-ai-chat-stg");
  assert.equal(body.input, "PROMPT_BODY_MARKER");
  assert.equal(body.max_output_tokens, 300);
  assert.equal(body.store, false);
});

// --- Disposition 5: completed valid text (BOTH extraction paths) ---
test("completed_text via top-level output_text", async () => {
  const { result } = await run({ status: "completed", output_text: "A grounded reflection." });
  assert.equal(result.kind, "completed");
  assert.equal(result.assistantMessage, "A grounded reflection.");
  assert.equal(result.provider_disposition, "completed_text");
});

test("completed_text via output[].content[].text (reasoning item skipped)", async () => {
  const { result } = await run({
    status: "completed",
    output: [
      { type: "reasoning", summary: [] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: "Notice one small step." }] },
    ],
  });
  assert.equal(result.kind, "completed");
  assert.equal(result.assistantMessage, "Notice one small step.");
  assert.equal(result.provider_disposition, "completed_text");
});

// --- Disposition 3: completed but empty output ---
test("completed_empty_output -> graceful fallback (server_error), not malformed", async () => {
  const { result } = await run({ status: "completed", output: [] });
  assert.equal(result.kind, "server_error");
  assert.equal(result.provider_disposition, "completed_empty_output");
});

// --- Disposition 4: completed non-text output ---
test("completed_non_text_output -> graceful fallback (server_error), not malformed", async () => {
  const { result } = await run({ status: "completed", output: [{ type: "reasoning", summary: [] }] });
  assert.equal(result.kind, "server_error");
  assert.equal(result.provider_disposition, "completed_non_text_output");
});

// --- Disposition 2: incomplete (non-filter, e.g. token budget) is NOT a schema rejection ---
test("incomplete (max_output_tokens) -> incomplete_or_content_filter, graceful fallback (not malformed)", async () => {
  const { result } = await run({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
    output: [{ type: "reasoning", summary: [] }],
  });
  assert.equal(result.kind, "server_error");
  assert.equal(result.provider_disposition, "incomplete_or_content_filter");
});

// --- Disposition 2: content filter (block + partial) ---
test("content_filter error -> content_filter_block / incomplete_or_content_filter", async () => {
  const { result } = await run({ error: { code: "content_filter" } }, 200);
  assert.equal(result.kind, "content_filter_block");
  assert.equal(result.provider_disposition, "incomplete_or_content_filter");
});

test("incomplete content_filter -> content_filter_partial / incomplete_or_content_filter", async () => {
  const { result } = await run({ status: "incomplete", incomplete_details: { reason: "content_filter" } });
  assert.equal(result.kind, "content_filter_partial");
  assert.equal(result.provider_disposition, "incomplete_or_content_filter");
});

// --- Disposition 1: non-success HTTP or unparseable body -> hard schema rejection (malformed) ---
test("HTTP 400 non-filter body -> malformed / http_or_schema_rejected", async () => {
  const { result } = await run({ error: { code: "invalid_request_error" } }, 400);
  assert.equal(result.kind, "malformed");
  assert.equal(result.provider_disposition, "http_or_schema_rejected");
});

test("HTTP 200 but unparseable body -> malformed / http_or_schema_rejected", async () => {
  const { result } = await run(null, 200, "<<not json>>");
  assert.equal(result.kind, "malformed");
  assert.equal(result.provider_disposition, "http_or_schema_rejected");
});

// --- Transport-level statuses keep their kinds and carry NO disposition ---
test("transport statuses (401/403/429/5xx) map to kinds with no disposition", async () => {
  for (const [status, kind] of [[401, "unauthorized"], [403, "forbidden"], [429, "rate_limited"], [500, "server_error"], [503, "server_error"]] as const) {
    const { result } = await run({}, status);
    assert.equal(result.kind, kind, `status ${status}`);
    assert.equal(result.provider_disposition, undefined, `status ${status} carries no response disposition`);
  }
});

// --- The disposition is a bare enum: never a body, header, url, key, or Azure identifier ---
test("provider_disposition is a bare enum string (no body/header/url/key retained)", async () => {
  const { result } = await run({ status: "completed", output_text: `leak ${SECRET}` });
  assert.equal(result.provider_disposition, "completed_text");
  assert.equal(JSON.stringify(result.provider_disposition).includes(SECRET), false);
  assert.equal(JSON.stringify(result.provider_disposition).includes("responses"), false);
});
