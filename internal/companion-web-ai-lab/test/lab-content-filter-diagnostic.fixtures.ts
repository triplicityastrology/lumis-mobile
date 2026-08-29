// Staging-only content-filter diagnostic tests (redaction-only).
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-content-filter-diagnostic.fixtures.js
//
// Proves: each supported Azure error shape is parsed to the closed summary; raw error content cannot
// leak; unknown shapes fail closed as category=unknown; successful responses are unchanged; and the
// redacted summary appears on the adapter result ONLY under the explicit diagnostic flag (and never
// carries the server-side x-policy-id).

import test from "node:test";
import { strict as assert } from "node:assert";
import {
  createLabAzureResponsesAdapter,
  summarizeAzureContentFilter,
  LAB_AZURE_POLICY_ID,
  LAB_FILTER_DIAGNOSTIC_FLAG,
  type ContentFilterCategoryHit,
} from "../src/lab-azure-responses-adapter.ts";
import { readChatAzureServerConfig } from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";

const CLOSED_KEYS = ["source_type", "category", "severity", "detected", "filtered", "blocked"].sort();
const RAW_LEAK = "RAW_PROMPT_AND_MESSAGE_MUST_NOT_LEAK";

function assertClosed(hits: ContentFilterCategoryHit[]) {
  for (const hit of hits) {
    assert.deepEqual(Object.keys(hit as object).sort(), CLOSED_KEYS, "hit must carry ONLY the closed keys");
  }
  // No raw content, error prose, headers, urls, keys, or the policy id may appear anywhere in the summary.
  const serialized = JSON.stringify(hits);
  for (const forbidden of [RAW_LEAK, LAB_AZURE_POLICY_ID, "x-policy-id", "responses", "api-key", "message"]) {
    assert.equal(serialized.includes(forbidden), false, `summary must not contain "${forbidden}"`);
  }
}

// --- Shape 1: error.innererror.content_filter_result (prompt side) ---
test("parses error.innererror.content_filter_result (self_harm blocked)", () => {
  const hits = summarizeAzureContentFilter({
    error: {
      code: "content_filter",
      message: `blocked because of ${RAW_LEAK}`,
      innererror: {
        content_filter_result: {
          self_harm: { filtered: true, severity: "medium" },
          violence: { filtered: false, severity: "safe" },
        },
      },
    },
  });
  assertClosed(hits);
  const sh = hits.find((h) => h.category === "self_harm");
  assert.ok(sh && sh.source_type === "prompt" && sh.filtered && sh.blocked && sh.severity === "medium");
  const vi = hits.find((h) => h.category === "violence");
  assert.ok(vi && vi.filtered === false && vi.blocked === false);
});

// --- Shape 2: error.inner_error.content_filter_results (underscore variant) ---
test("parses error.inner_error.content_filter_results", () => {
  const hits = summarizeAzureContentFilter({
    error: { code: "content_filter", inner_error: { content_filter_results: { hate: { filtered: true, severity: "high" } } } },
  });
  assertClosed(hits);
  assert.equal(hits[0].category, "hate");
  assert.equal(hits[0].severity, "high");
  assert.equal(hits[0].source_type, "prompt");
});

// --- Shape 3: jailbreak / indirect_attack detection (detected boolean, no severity) ---
test("parses jailbreak + indirect_attack detection flags", () => {
  const hits = summarizeAzureContentFilter({
    error: {
      code: "content_filter",
      innererror: {
        content_filter_result: {
          jailbreak: { filtered: true, detected: true },
          indirect_attack: { filtered: false, detected: false },
        },
      },
    },
  });
  assertClosed(hits);
  const jb = hits.find((h) => h.category === "jailbreak");
  assert.ok(jb && jb.detected === true && jb.blocked === true && jb.severity === null);
  const ia = hits.find((h) => h.category === "indirect_attack");
  assert.ok(ia && ia.detected === false && ia.blocked === false);
});

// --- Shape 4: top-level prompt_filter_results array ---
test("parses prompt_filter_results array shape", () => {
  const hits = summarizeAzureContentFilter({
    prompt_filter_results: [{ prompt_index: 0, content_filter_results: { sexual: { filtered: true, severity: "low" } } }],
  });
  assertClosed(hits);
  assert.equal(hits[0].category, "sexual");
  assert.equal(hits[0].source_type, "prompt");
});

// --- Shape 5: top-level content_filter_results (completion side) ---
test("parses top-level content_filter_results as completion", () => {
  const hits = summarizeAzureContentFilter({ content_filter_results: { violence: { filtered: true, severity: "high" } } });
  assertClosed(hits);
  assert.equal(hits[0].source_type, "completion");
  assert.equal(hits[0].category, "violence");
});

// --- Fail closed: unknown category key never surfaces raw ---
test("unknown category key fails closed to category=unknown", () => {
  const hits = summarizeAzureContentFilter({
    error: { code: "content_filter", innererror: { content_filter_result: { some_new_secret_category: { filtered: true, severity: "high" } } } },
  });
  assertClosed(hits);
  assert.equal(hits[0].category, "unknown");
  assert.equal(hits[0].blocked, true);
});

// --- Fail closed: recognised content-filter signal but no parseable detail ---
test("content_filter error with no detail fails closed (prompt, unknown, blocked)", () => {
  const hits = summarizeAzureContentFilter({ error: { code: "content_filter", message: RAW_LEAK } });
  assertClosed(hits);
  assert.deepEqual(hits, [{ source_type: "prompt", category: "unknown", severity: null, detected: null, filtered: true, blocked: true }]);
});

test("incomplete content_filter with no detail fails closed (completion)", () => {
  const hits = summarizeAzureContentFilter({ status: "incomplete", incomplete_details: { reason: "content_filter" } });
  assertClosed(hits);
  assert.equal(hits[0].source_type, "completion");
  assert.equal(hits[0].category, "unknown");
});

// --- Successful / non-filter bodies are unchanged (empty summary) ---
test("non-filter bodies produce no summary", () => {
  assert.deepEqual(summarizeAzureContentFilter({ status: "completed", output_text: RAW_LEAK }), []);
  assert.deepEqual(summarizeAzureContentFilter({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), []);
  assert.deepEqual(summarizeAzureContentFilter(null), []);
  assert.deepEqual(summarizeAzureContentFilter("string"), []);
});

// --- Adapter integration: summary present ONLY under the diagnostic flag ---
const cfg = readChatAzureServerConfig({ LUMIS_CHAT_AI_ENABLED: "true", LUMIS_CHAT_AZURE_API_KEY: "SECRET_KEY_DO_NOT_LEAK" });
if (!cfg.ok) throw new Error("config setup failed");
const baseInput = {
  providerAlias: "lumis-ai-chat-stg" as const,
  safetyProfile: "DefaultV2" as const,
  promptVersion: "companion_synthetic_prompt_v1" as const,
  language: "en" as const,
  promptInput: "PROMPT_BODY_MARKER",
  maxOutputTokens: 300 as const,
  deadlineAtMs: Date.now() + 12_000,
};
function filterAdapter(json: unknown) {
  const fn = (async () => new Response(JSON.stringify(json), { status: 200 })) as unknown as typeof fetch;
  return createLabAzureResponsesAdapter(cfg.config, fn, () => Date.now());
}
const FILTER_BODY = { error: { code: "content_filter", innererror: { content_filter_result: { self_harm: { filtered: true, severity: "high" } } } } };

test("adapter attaches redacted summary ONLY when LUMIS_LAB_FILTER_DIAGNOSTIC=1", async () => {
  const prev = process.env[LAB_FILTER_DIAGNOSTIC_FLAG];

  delete process.env[LAB_FILTER_DIAGNOSTIC_FLAG];
  const off = await filterAdapter(FILTER_BODY).complete({ ...baseInput, deadlineAtMs: Date.now() + 12_000 });
  assert.equal(off.provider_disposition, "content_filtered_input");
  assert.equal((off as { content_filter_diagnostic?: unknown }).content_filter_diagnostic, undefined, "no diagnostic without the flag");

  process.env[LAB_FILTER_DIAGNOSTIC_FLAG] = "1";
  const on = await filterAdapter(FILTER_BODY).complete({ ...baseInput, deadlineAtMs: Date.now() + 12_000 }) as { provider_disposition?: string; content_filter_diagnostic?: ContentFilterCategoryHit[] };
  assert.equal(on.provider_disposition, "content_filtered_input");
  assert.ok(on.content_filter_diagnostic && on.content_filter_diagnostic.length === 1);
  assertClosed(on.content_filter_diagnostic);
  assert.equal(on.content_filter_diagnostic[0].category, "self_harm");
  assert.equal(on.content_filter_diagnostic[0].blocked, true);
  // The whole serialized result must never carry the server-side policy id.
  assert.equal(JSON.stringify(on).includes(LAB_AZURE_POLICY_ID), false);

  if (prev === undefined) delete process.env[LAB_FILTER_DIAGNOSTIC_FLAG];
  else process.env[LAB_FILTER_DIAGNOSTIC_FLAG] = prev;
});

test("a successful completion carries no diagnostic even under the flag", async () => {
  const prev = process.env[LAB_FILTER_DIAGNOSTIC_FLAG];
  process.env[LAB_FILTER_DIAGNOSTIC_FLAG] = "1";
  const ok = await filterAdapter({ status: "completed", output_text: "A grounded reflection." }).complete({ ...baseInput, deadlineAtMs: Date.now() + 12_000 }) as { provider_disposition?: string; content_filter_diagnostic?: unknown };
  assert.equal(ok.provider_disposition, "completed_text");
  assert.equal(ok.content_filter_diagnostic, undefined);
  if (prev === undefined) delete process.env[LAB_FILTER_DIAGNOSTIC_FLAG];
  else process.env[LAB_FILTER_DIAGNOSTIC_FLAG] = prev;
});

console.log("lab content-filter diagnostic fixtures ready");
