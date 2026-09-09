// Founder testing prompt-override tests (internal Lab only).
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-prompt-override.fixtures.js
//
// Proves: on a GENERATIVE route an explicit prompt_override is sent to the model VERBATIM instead of
// the composed persona prompt; the deterministic pre-provider safety/crisis/out-of-scope gates still
// fire first (override never reaches them, no provider call); blank overrides are ignored; and the
// request validation bounds the field. Identity is injected so the authorized path runs offline; the
// provider "fetch" is a stub that records the request body (no real Azure call).

import test from "node:test";
import { strict as assert } from "node:assert";
import { handleConversationTurn } from "../src/lab-conversation.ts";
import { validateLabRequest } from "../src/lab-engine.ts";
import { mintIdentityReceipt, verifyIdentityReceipt, type RuntimeIdentity } from "../src/lab-identity.ts";

const SECRET = "SECRET_SENTINEL_KEY_DO_NOT_LEAK";
const enabledEnv = { LUMIS_CHAT_AI_ENABLED: "true", LUMIS_CHAT_AZURE_API_KEY: SECRET };
const CLEAN: RuntimeIdentity = { commit: "c0ffee".padEnd(40, "0"), tree: "tree01".padEnd(40, "0"), clean: true, packageChecksum: "pkg-1" };
const goodIdentity = () => verifyIdentityReceipt(mintIdentityReceipt(CLEAN), CLEAN);

const OVERRIDE = "SENTINEL_OVERRIDE_PROMPT_XYZ — say exactly this back.";
const COMPOSED_MARKER = "IDENTITY AND SCOPE"; // a Prompt v3 block header, present only in a composed prompt

function req(over: Record<string, unknown> = {}) {
  return {
    schema_version: "companion_web_ai_lab_request_v1",
    role_code: "empathetic_peer",
    chart: { sun: 3, moon: 6, mercury: 3, saturn: 10, moon_confirmed: true },
    message: "hello",
    app_language_preference: null,
    context: [],
    ...over,
  };
}

function spyFetch(reply = "ok") {
  const calls: Array<{ url: string; body: string }> = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: typeof init?.body === "string" ? init.body : "" });
    return new Response(JSON.stringify({ output_text: reply }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

// --- 1. Override replaces the composed prompt on a generative route (sent verbatim) ---
test("prompt_override is sent to the model verbatim on a generative route", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "I feel a bit stuck.", prompt_override: OVERRIDE }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(spy.calls.length, 1, "exactly one provider call");
  assert.ok(spy.calls[0].body.includes("SENTINEL_OVERRIDE_PROMPT_XYZ"), "override text is in the provider request");
  assert.ok(!spy.calls[0].body.includes(COMPOSED_MARKER), "composed persona prompt was NOT sent");
  assert.equal(b.prompt_override_applied, true);
  assert.ok(typeof b.generative_prompt_preview === "string" && b.generative_prompt_preview.includes("SENTINEL_OVERRIDE_PROMPT_XYZ"), "preview shows the override");
  assert.equal(b.persona_blocks, null, "no composed blocks when overridden");
});

// --- 2. Without an override, the composed prompt is used ---
test("without an override the composed persona prompt is sent", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "I feel a bit stuck." }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(spy.calls.length, 1);
  assert.ok(spy.calls[0].body.includes(COMPOSED_MARKER), "composed persona prompt was sent");
  assert.equal(b.prompt_override_applied, false);
});

// --- 3. Safety still fires first even with an override set (no provider call, override ignored) ---
test("a crisis message returns the fixed template and never sends the override", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "I want to kill myself tonight.", prompt_override: OVERRIDE }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(spy.calls.length, 0, "no provider call on a safety route");
  assert.equal(b.canonical_state, "crisis_imminent");
  assert.equal(b.prompt_override_applied, false);
  assert.ok(!String(b.assistant_message ?? "").includes("SENTINEL_OVERRIDE_PROMPT_XYZ"), "override is not the reply");
});

// --- 4. Out-of-scope / professional still fires first with an override set ---
test("an out-of-scope message returns the fixed template and never sends the override", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "Can you diagnose this medical symptom for me?", prompt_override: OVERRIDE }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(spy.calls.length, 0, "no provider call on an out-of-scope route");
  assert.ok(b.canonical_state === "out_of_scope" || b.canonical_state === "professional_direct");
  assert.equal(b.prompt_override_applied, false);
});

// --- 5. A blank override is ignored (composed prompt is used) ---
test("a blank/whitespace override is ignored", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "I feel a bit stuck.", prompt_override: "   \n  " }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.ok(spy.calls[0].body.includes(COMPOSED_MARKER), "composed prompt used when override is blank");
  assert.equal(b.prompt_override_applied, false);
});

// --- 6. Request validation bounds the field ---
test("prompt_override validation: type + length", () => {
  const nonString = validateLabRequest(req({ prompt_override: 123 }));
  assert.equal(nonString.ok, false);
  if (!nonString.ok) assert.equal(nonString.error_code, "LAB_PROMPT_OVERRIDE_INVALID");

  const tooLong = validateLabRequest(req({ prompt_override: "x".repeat(20001) }));
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.error_code, "LAB_PROMPT_OVERRIDE_TOO_LONG");

  const ok = validateLabRequest(req({ prompt_override: OVERRIDE }));
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.request.prompt_override, OVERRIDE);

  const blank = validateLabRequest(req({ prompt_override: "   " }));
  assert.equal(blank.ok, true);
  if (blank.ok) assert.equal(blank.request.prompt_override, undefined, "blank override normalises to absent");
});

console.log("lab prompt-override fixtures ready");
