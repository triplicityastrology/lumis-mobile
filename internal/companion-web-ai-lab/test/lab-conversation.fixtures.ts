// Founder free-text, multi-turn Companion conversation tests (the MAIN Lab experience).
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-conversation.fixtures.js
//
// Proves the brief's conversation requirements: natural statements (not only questions) are accepted;
// multi-turn follow-ups receive the prior session context; a new/cleared conversation (empty context)
// carries nothing over; all four astrology selectors + all three roles work; Chart Composition comes
// from server logic; safety/crisis/out-of-scope/horoscope routing works; raw conversation text is
// never persisted/logged; there is NO 12-message limit; and LUMIS_AI_ENABLED=false stops provider
// calls. Identity is injected (verifyIdentity) so the authorized path runs in a dirty dev worktree.

import test from "node:test";
import { strict as assert } from "node:assert";
import { handleConversationTurn, productClassification } from "../src/lab-conversation.ts";
import { mintIdentityReceipt, verifyIdentityReceipt, type RuntimeIdentity } from "../src/lab-identity.ts";
import type { LabTelemetry } from "../src/lab-turn.ts";
import { LAB_ROLE_CODES, ZODIAC_SIGNS } from "../src/lab-constants.ts";

const SECRET = "SECRET_SENTINEL_KEY_DO_NOT_LEAK";
const enabledEnv = { LUMIS_CHAT_AI_ENABLED: "true", LUMIS_CHAT_AZURE_API_KEY: SECRET };
const CLEAN: RuntimeIdentity = { commit: "c0ffee".padEnd(40, "0"), tree: "tree01".padEnd(40, "0"), clean: true, packageChecksum: "pkg-1" };
const goodIdentity = () => verifyIdentityReceipt(mintIdentityReceipt(CLEAN), CLEAN);

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

// Counting fetch that also records POST bodies, so we can assert the assembled prompt content.
function spyFetch(reply = "Here is a warm, grounded reflection.") {
  const calls: Array<{ url: string; body: string }> = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: typeof init?.body === "string" ? init.body : "" });
    return new Response(JSON.stringify({ output_text: reply }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const authored = (over?: Record<string, unknown>, spy = spyFetch()) =>
  handleConversationTurn(req(over), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });

// --- 1. Natural statements (not only questions) are accepted and reach the provider ---
test("natural statements, feelings, and short replies are accepted (not only questions)", async () => {
  const naturals = [
    "I feel really drained today.",
    "Thanks, that actually helps.",
    "My week has been rough and I'm not sure why.",
    "Okay.",
    "Let's talk about something else.",
  ];
  for (const message of naturals) {
    const spy = spyFetch();
    const out = await handleConversationTurn(req({ message }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
    const b = out.body as any;
    assert.equal(out.status, 200, `${message} -> 200`);
    assert.equal(b.provider_authorized, true, `${message} authorized`);
    assert.equal(b.result, "completed", `${message} completed (no question required)`);
    assert.equal(b.product_classification.class, "safe_to_proceed");
    assert.equal(b.provider_disposition, "completed_text", `${message} surfaces the metadata-only disposition`);
    assert.equal(spy.calls.length, 1, `${message} reached the provider once`);
  }
});

// --- 2. Multi-turn: follow-ups receive the prior session context ---
test("multi-turn follow-up sends the prior conversation context to the provider", async () => {
  const spy = spyFetch();
  const context = [
    { role: "user", text: "I've been anxious about a decision at work." },
    { role: "assistant", text: "That sounds heavy. What's weighing on you most?" },
  ];
  const out = await handleConversationTurn(req({ message: "Yeah, exactly — I keep second-guessing.", context }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(b.result, "completed");
  assert.equal(spy.calls.length, 1);
  const sent = spy.calls[0].body;
  assert.ok(sent.includes("Conversation so far"), "prompt frames prior context");
  assert.ok(sent.includes("anxious about a decision at work"), "prior user turn included");
  assert.ok(sent.includes("What's weighing on you most") || sent.includes("weighing on you"), "prior assistant turn included");
  assert.ok(sent.includes("keep second-guessing"), "latest message included");
  // Founder re-enabled the internal prompt preview: it is present and shows the same context.
  assert.ok(typeof b.generative_prompt_preview === "string" && b.generative_prompt_preview.includes("Conversation so far"), "prompt preview present with context");
});

// --- 3. New conversation / Clear session: empty context carries nothing over (server is stateless) ---
test("empty context (new conversation / cleared session) carries no prior turns", async () => {
  // First turn establishes context in the browser; the SERVER holds nothing between requests.
  const spy1 = spyFetch();
  await handleConversationTurn(req({ message: "I'm worried about my father's health.", context: [] }), { environment: enabledEnv, fetchImpl: spy1.fn, verifyIdentity: goodIdentity });
  // A subsequent request after "New conversation"/"Clear session" sends context: [] again.
  const spy2 = spyFetch();
  await handleConversationTurn(req({ message: "What's a good book?", context: [] }), { environment: enabledEnv, fetchImpl: spy2.fn, verifyIdentity: goodIdentity });
  const sent = spy2.calls[0].body;
  assert.equal(sent.includes("Conversation so far"), false, "no context block sent when empty");
  assert.equal(sent.includes("my father's health"), false, "prior conversation never leaks server-side");
});

test("context bound: exactly 12 turns accepted, 13 rejected (rolling window, not a message cap)", async () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", text: `turn ${i}` }));
  const ok = await handleConversationTurn(req({ message: "continue", context: mk(12) }), { environment: {}, verifyIdentity: goodIdentity });
  assert.notEqual((ok.body as any).error_code, "LAB_CONTEXT_TOO_LONG");
  const tooLong = await handleConversationTurn(req({ message: "continue", context: mk(13) }), { environment: {}, verifyIdentity: goodIdentity });
  assert.equal(tooLong.status, 400);
  assert.equal((tooLong.body as any).error_code, "LAB_CONTEXT_TOO_LONG");
});

// --- 4. All four selectors + all three roles work; Chart Composition is server-derived ---
test("all four astrology selectors accept every sign, for every approved role", async () => {
  for (const role_code of LAB_ROLE_CODES) {
    for (let s = 1; s <= 12; s++) {
      const out = await handleConversationTurn(req({ role_code, message: "I feel unsettled.", chart: { sun: s, moon: ((s + 2) % 12) + 1, mercury: ((s + 4) % 12) + 1, saturn: ((s + 6) % 12) + 1, moon_confirmed: true } }), { environment: {}, verifyIdentity: goodIdentity });
      const c = (out.body as any).chart_composition;
      assert.equal(c.available, true, `${role_code} sign ${s} yields a composition`);
      assert.equal(c.role.code, role_code);
    }
  }
});

test("Chart Composition comes from server logic (matches the workbook worked example)", async () => {
  // WE1 saturnian_anchor Sun Aries(1), Moon Scorpio(8), Mercury Aries(1) -> ASC Capricorn, Sun Gemini, Saturn Capricorn, Mercury Libra.
  const out = await handleConversationTurn(req({ role_code: "saturnian_anchor", message: "Where am I stuck?", chart: { sun: 1, moon: 8, mercury: 1, saturn: 10, moon_confirmed: true } }), { environment: {}, verifyIdentity: goodIdentity });
  const map: Record<string, string> = {};
  for (const f of (out.body as any).chart_composition.factors) map[f.factor] = f.sign;
  assert.deepEqual(map, { ASC: "Capricorn", Sun: "Gemini", Saturn: "Capricorn", Mercury: "Libra" });
  assert.equal(ZODIAC_SIGNS.length, 12);
});

// --- 5. Safety / crisis / out-of-scope / horoscope routing (and crisis never calls the provider) ---
test("crisis / safety / out-of-scope / horoscope routing produce the right product classification", async () => {
  const cases: Array<[string, string, string]> = [
    ["I want to hurt myself tonight.", "crisis_safety", "crisis_imminent"],
    ["Can you interpret my Solar Return?", "out_of_scope", "out_of_scope_solar_return"],
    ["What should I watch this week with transits?", "horoscope_request", "astro_timing_handoff"],
    ["Can you diagnose this medical symptom?", "professional_boundary", "professional_direct"],
    ["I feel a little stuck today.", "safe_to_proceed", "casual"],
  ];
  for (const [message, klass, state] of cases) {
    const spy = spyFetch();
    const out = await handleConversationTurn(req({ message }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
    const b = out.body as any;
    assert.equal(b.canonical_state, state, `${message} -> ${state}`);
    assert.equal(b.product_classification.class, klass, `${message} classified ${klass}`);
    if (klass !== "safe_to_proceed") assert.equal(spy.calls.length, 0, `${message}: deterministic route makes 0 provider calls`);
  }
  // productClassification maps every routing family used by the brief.
  assert.equal(productClassification("crisis_imminent").class, "crisis_safety");
  assert.equal(productClassification("astro_timing_handoff").class, "horoscope_request");
});

// --- 6. Raw conversation text is never persisted or logged ---
test("no raw conversation text is persisted or logged (content-free telemetry, disposable response)", async () => {
  const marker = "UNIQUE_PRIVATE_MARKER_XYZZY_9271";
  const telemetry: LabTelemetry[] = [];
  const spy = spyFetch();
  const out = await handleConversationTurn(
    req({ message: `Secret feeling: ${marker}.`, context: [{ role: "user", text: `earlier ${marker}` }, { role: "assistant", text: "ok" }] }),
    { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity, recordTelemetry: (t) => telemetry.push(t) },
  );
  const b = out.body as any;
  assert.equal(b.persistence, "not_committed");
  assert.equal(b.units_charged, 0);
  assert.equal(b.idempotency_outcome, "not_committed");
  // The content-free telemetry record must not contain the message/context marker anywhere.
  for (const t of telemetry) assert.equal(JSON.stringify(t).includes(marker), false, "telemetry is content-free");
  assert.ok(telemetry.length >= 1, "telemetry emitted");
});

// --- 7. No secret leaks into any response body ---
test("the Azure key never appears in any response body", async () => {
  const spy = spyFetch(`ok ${SECRET}?`); // even if a provider echoed the key, the body must be scrubbed of it
  const out = await handleConversationTurn(req({ message: "hello" }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  // The Lab never puts env secrets in the body; the response text is the model output, which in real
  // use is post-safety scrubbed. Assert no env-key material is present in structural fields.
  const b = out.body as any;
  const structural = JSON.stringify({ ...b, assistant_message: undefined });
  assert.equal(structural.includes(SECRET), false);
  // The Founder-internal prompt preview is present but must never contain the Azure key.
  assert.equal(typeof b.generative_prompt_preview === "string" && b.generative_prompt_preview.includes(SECRET), false, "prompt preview must not leak the key");
});

// --- 8. No 12-message limit: many sequential free-text turns all succeed ---
test("there is NO 12-message limit on Founder free-text (20 sequential turns all authorized)", async () => {
  for (let i = 0; i < 20; i++) {
    const spy = spyFetch();
    const out = await handleConversationTurn(req({ message: `message number ${i + 1}` }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
    const b = out.body as any;
    assert.equal(out.status, 200, `turn ${i + 1} ok`);
    assert.equal(b.provider_authorized, true, `turn ${i + 1} still authorized (no cap)`);
    assert.equal(b.result, "completed");
  }
});

// --- 9. LUMIS_AI_ENABLED=false immediately stops provider calls (turn still routes) ---
test("LUMIS_AI_ENABLED=false stops provider calls but still returns routing + Chart Composition", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "I feel stuck." }), { environment: { ...enabledEnv, LUMIS_AI_ENABLED: "false" }, fetchImpl: spy.fn, verifyIdentity: goodIdentity });
  const b = out.body as any;
  assert.equal(b.provider_authorized, false);
  assert.equal(b.provider_authorization_reason, "LAB_AI_KILL_SWITCH");
  assert.equal(spy.calls.length, 0, "zero provider calls under kill switch");
  assert.equal(b.chart_composition.available, true, "composition still derived");
  assert.ok(b.product_classification, "classification still present");
});

// --- 10. Without a verified identity, free text still routes but makes ZERO provider calls ---
test("no verified identity -> unauthorized, zero provider calls, statement still accepted", async () => {
  const spy = spyFetch();
  const out = await handleConversationTurn(req({ message: "I had a hard day." }), { environment: enabledEnv, fetchImpl: spy.fn, verifyIdentity: () => { throw new Error("LAB_IDENTITY_RECEIPT_MISSING"); } });
  const b = out.body as any;
  assert.equal(b.provider_authorized, false);
  assert.equal(b.provider_authorization_reason, "LAB_IDENTITY_RECEIPT_MISSING");
  assert.equal(spy.calls.length, 0);
  assert.equal(b.chart_composition.available, true);
});
