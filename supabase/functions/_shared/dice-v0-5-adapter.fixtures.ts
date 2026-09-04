/** v5 Azure adapter integration test (node-runnable; MOCK fetch, no network).
 * Verifies createDiceV05Adapter builds the correct Azure Responses request (strict
 * Structured Outputs) and maps HTTP/provider statuses to the window's result union.
 * This puts azure-dice-adapter-v5.ts into the compiled v5 test surface (reviewer item 13). */
import { createDiceV05Adapter } from "./azure-dice-adapter-v5.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

const config = Object.freeze({
  endpoint: "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com",
  deployment: "lumis-ai-chat-stg", routeFamily: "v1" as const, apiKey: "TEST_KEY_NOT_A_SECRET",
} as any);

type FetchCall = { url: string; init: any };
function mockFetch(status: number, body: unknown, capture?: FetchCall[]): typeof fetch {
  return (async (url: any, init: any) => {
    capture?.push({ url: String(url), init });
    return { status, ok: status >= 200 && status < 300, json: async () => body } as any;
  }) as any;
}
const invokeInput = () => ({ prompt: "BLOCK\nINPUT_JSON:\n{}", deadline_at_ms: Date.now() + 10000, max_output_tokens: 600, schema_name: "lumis_dice_judgment_v5_stage2", schema: { type: "object" }, signal: new AbortController().signal });

async function main() {
  // Config guard.
  let threw = false;
  try { createDiceV05Adapter({ ...config, endpoint: "https://evil.example.com" }); } catch { threw = true; }
  ok(threw, "adapter rejects a non-approved endpoint");

  // Request shape (strict Structured Outputs).
  const cap: FetchCall[] = [];
  const okBody = { output: [{ content: [{ type: "output_text", text: '{"status":"ok"}' }] }] };
  let adapter = createDiceV05Adapter(config, mockFetch(200, okBody, cap));
  const r1 = await adapter.invoke(invokeInput());
  ok(r1.kind === "success" && (r1 as any).content === '{"status":"ok"}', "200 output → success + content");
  const call = cap[0]; const sent = JSON.parse(call.init.body);
  eq(call.url, "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com/openai/v1/responses", "request URL");
  eq(call.init.headers["api-key"], "TEST_KEY_NOT_A_SECRET", "api-key header");
  eq(sent.model, "lumis-ai-chat-stg", "body.model = deployment");
  eq(sent.input, "BLOCK\nINPUT_JSON:\n{}", "body.input = prompt");
  eq(sent.max_output_tokens, 600, "body.max_output_tokens");
  eq(sent.reasoning, { effort: "minimal" }, "reasoning.effort minimal");
  eq(sent.store, false, "store false");
  eq(sent.text.verbosity, "low", "text.verbosity low");
  eq(sent.text.format.type, "json_schema", "text.format json_schema");
  eq(sent.text.format.strict, true, "strict true");
  eq(sent.text.format.name, "lumis_dice_judgment_v5_stage2", "schema name passed");

  // output_text shorthand also works.
  adapter = createDiceV05Adapter(config, mockFetch(200, { output_text: "hello" }));
  eq((await adapter.invoke(invokeInput())).kind, "success", "output_text → success");

  // Status mapping.
  eq((await createDiceV05Adapter(config, mockFetch(401, {})).invoke(invokeInput())).kind, "authentication", "401 → authentication");
  eq((await createDiceV05Adapter(config, mockFetch(403, {})).invoke(invokeInput())).kind, "permission", "403 → permission");
  eq((await createDiceV05Adapter(config, mockFetch(429, {})).invoke(invokeInput())).kind, "server", "429 → server");
  eq((await createDiceV05Adapter(config, mockFetch(500, {})).invoke(invokeInput())).kind, "server", "500 → server");
  eq((await createDiceV05Adapter(config, mockFetch(400, {})).invoke(invokeInput())).kind, "malformed", "400 not-ok → malformed");
  eq((await createDiceV05Adapter(config, mockFetch(200, { status: "incomplete" })).invoke(invokeInput())).kind, "malformed", "incomplete → malformed");
  eq((await createDiceV05Adapter(config, mockFetch(200, {})).invoke(invokeInput())).kind, "malformed", "no content → malformed");
  eq((await createDiceV05Adapter(config, mockFetch(200, { status: "content_filter", output: [] })).invoke(invokeInput())).kind, "content_filter", "content_filter status → content_filter");
  eq((await createDiceV05Adapter(config, mockFetch(200, { incomplete_details: { reason: "content_filter" }, output: [] })).invoke(invokeInput())).kind, "content_filter", "incomplete content_filter → content_filter");
  // MB-2 (test 1): an HTTP-error content-filter ENVELOPE must be recognized BEFORE the generic
  // non-OK → malformed path, so it is non-retryable. This is the exact QA-reproduced body.
  eq((await createDiceV05Adapter(config, mockFetch(400, { error: { code: "content_filter", status: 400 } })).invoke(invokeInput())).kind, "content_filter", "HTTP 400 error.code=content_filter → content_filter (not malformed)");
  // A non-content-filter HTTP 400 error stays malformed — a plain 400 is NOT misread as filtered.
  eq((await createDiceV05Adapter(config, mockFetch(400, { error: { code: "invalid_request_error", status: 400 } })).invoke(invokeInput())).kind, "malformed", "HTTP 400 non-content-filter error → malformed");

  // A thrown fetch → network; an aborted fetch → timeout.
  const throwing = createDiceV05Adapter(config, (async () => { throw new Error("boom"); }) as any);
  eq((await throwing.invoke(invokeInput())).kind, "network", "fetch throw → network");
  const aborting = createDiceV05Adapter(config, (async () => { const e: any = new DOMException("abort", "AbortError"); throw e; }) as any);
  eq((await aborting.invoke(invokeInput())).kind, "timeout", "AbortError → timeout");
  // Past deadline → timeout before any fetch.
  const past = createDiceV05Adapter(config, mockFetch(200, okBody));
  eq((await past.invoke({ ...invokeInput(), deadline_at_ms: Date.now() - 1 })).kind, "timeout", "past deadline → timeout");

  console.log("dice-v0-5 adapter fixtures passed");
}
void main();
