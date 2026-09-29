/** Stage-4 meaning-checker — unit fixtures (node-runnable; MOCK adapter, no network). Verifies the
 * server-determined required check keys, the strict mode-aware output schema, the strict parse, the
 * SERVER acceptance rule (accept iff every required check is "preserves"), the request+source binding
 * fingerprint (B02), duplicate-key rejection (B03), the carried-outcome validation used at the Web
 * boundary, the one-attempt bounded runner including late/aborted rejection (B06), and the largest legal
 * verdict envelope + input for EVERY mode/language (B07 token measurement). MOCK verdicts prove HANDLING
 * and WIRING only — NOT that a real checker detects semantic errors; that is the deferred live evaluation. */
import {
  DICE_V05_FIDELITY_SCHEMA, DICE_V05_FIDELITY_BLOCK, WHOLE_DISPLAY_KEY,
  fidelityCheckKeys, buildFidelitySchema, buildFidelityInput, buildFidelityProviderInput,
  parseFidelityResponse, fidelityDecision, candidateFingerprint, assembledVisibleText,
  validateCarriedFidelity, fidelityOutcomeToWire, runFidelityCheck,
  parseJsonRejectDuplicateKeys, fidelityComponentsFromWire, sha256Hex,
  CHECKER_OUTPUT_CAP, CHECKER_GEN_CAP, CHECKER_INPUT_CAP,
} from "./dice-v0-5-copy-fidelity.ts";
import { deterministicCustomerCopy, type DiceV05CustomerCopy, type Landing } from "./dice-v0-5-customer-copy.ts";
import { validateDiceV05FinalResult, type DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";
import type { DiceV05Language } from "./dice-v0-5-fixed-data.ts";
import type { DiceV05ProviderAdapter, DiceV05ProviderResult } from "./dice-v0-5-window.ts";
import type { DiceV05PlanetId, DiceV05SignId } from "./dice-v0-5-fixed-data.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }
const L = (planet: string, sign: string, house: number): Landing => ({ planet: planet as DiceV05PlanetId, sign: sign as DiceV05SignId, house });

const judgment = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "judgment",
  planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護", strength: "strong", constructive_traits: "Generous", difficult_traits: "Wasteful", dignity_emphasis: "constructive", prose: "Jupiter is a major benefic at full strength here." },
  house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: "House 1 is the most supportive setting, with the matter in your hands." },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "Both fixed sides are favourable and remain separate.", timing_summary: null,
  watch_out: "Keep optimism realistic even with strong support.", practical_step: null, suggested_followups: ["What should I prepare first?"],
});
eq(validateDiceV05FinalResult(judgment as any), "OK", "control: judgment canonical valid");
const jLanding = L("jupiter", "sagittarius", 1);
const copy: DiceV05CustomerCopy = deterministicCustomerCopy(judgment as any);
const components = { answer: "You have real support.", planet_factor: "Your side is strong.", house_factor: "The setting supports you.", synthesis: "The two agree.", watch_out: "Keep hopes realistic.", followup_1: "What is worth preparing first?" };
const Q = "Should I accept this promotion?";

// A verdict-changing SOURCE swap that is itself a schema-valid final: the meaning is opposite, so a
// verdict produced for `judgment` must NOT validate against this one (B02 source binding).
const judgmentOpposite = Object.freeze({ ...judgment,
  planet_side: { ...(judgment as any).planet_side, dignity_emphasis: "difficult", prose: "Jupiter is weak and works against the matter here." },
  house_side: { ...(judgment as any).house_side, fortune: "misfortune", prose: "House 1 is an obstructive setting that resists the matter." },
  synthesis: "Both fixed sides are difficult and remain separate.",
});
eq(validateDiceV05FinalResult(judgmentOpposite as any), "OK", "control: opposite judgment canonical also valid");

async function main() {
  // ---- Required keys, schema, input (unchanged contract) ------------------------------------------
  const keys = fidelityCheckKeys(judgment as any);
  ok(keys.includes("answer") && keys.includes("planet_factor") && keys.includes("house_factor") && keys.includes("synthesis") && keys.includes("watch_out") && keys.includes("followup_1") && keys.includes(WHOLE_DISPLAY_KEY), "required keys cover every edited component + whole_display");

  const schema: any = buildFidelitySchema(judgment as any, "en");
  eq(schema.additionalProperties, false, "schema closed at top level");
  eq(schema.properties.checks.additionalProperties, false, "checks object closed");
  eq(schema.properties.fidelity_schema.const, DICE_V05_FIDELITY_SCHEMA, "checker schema id pinned");
  eq(schema.properties.language.const, "en", "language pinned"); eq(schema.properties.question_mode.const, "judgment", "mode pinned");
  eq(schema.properties.checks.required.slice().sort(), keys.slice().sort(), "checks required = the server-determined keys");
  eq(schema.properties.checks.properties.whole_display.enum, ["preserves", "changes", "uncertain"], "each check is a preserves/changes/uncertain enum");

  const input = buildFidelityInput(judgment as any, copy, components, Q, jLanding);
  ok(input.fidelity_schema === DICE_V05_FIDELITY_SCHEMA && input.language === "en" && input.question_mode === "judgment", "input identity");
  ok(input.source.planet_factor && input.source.house_factor && input.source.synthesis && input.source.watch_out, "input carries the source meaning-bearing fields");
  ok((input.proposed as any).answer && (input.proposed as any).assembled_headline, "input carries the proposed components + assembled visible fields");
  ok(input.assembled_display === assembledVisibleText(copy), "input carries the exact assembled customer-visible text");
  ok(Array.isArray(input.required_checks) && input.required_checks.includes(WHOLE_DISPLAY_KEY), "input names the required checks incl whole_display");
  const providerInput = buildFidelityProviderInput(input);
  ok(providerInput.startsWith(DICE_V05_FIDELITY_BLOCK), "provider input begins with the fixed checker block");

  // ---- Parse + acceptance rule --------------------------------------------------------------------
  const mk = (over: Record<string, string> = {}) => JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: Object.fromEntries(keys.map((k) => [k, over[k] ?? "preserves"])) });
  const good = parseFidelityResponse(judgment as any, "en", mk());
  eq(good.kind, "ok", "valid all-preserves response parses");
  eq(fidelityDecision(judgment as any, good), "OK", "server acceptance: all preserves → OK");
  eq(fidelityDecision(judgment as any, parseFidelityResponse(judgment as any, "en", mk({ watch_out: "changes" }))), "DICE_CHECKER_CHANGED", "a single 'changes' rejects");
  eq(fidelityDecision(judgment as any, parseFidelityResponse(judgment as any, "en", mk({ [WHOLE_DISPLAY_KEY]: "uncertain" }))), "DICE_CHECKER_UNCERTAIN", "a single 'uncertain' rejects");

  eq(parseFidelityResponse(judgment as any, "en", "{ not json").kind, "invalid", "malformed JSON rejected");
  eq((parseFidelityResponse(judgment as any, "en", JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: Object.fromEntries(keys.map((k) => [k, "preserves"])), extra: 1 })) as any).code, "DICE_CHECKER_EXTRA_OR_MISSING_KEY", "extra top-level key rejected");
  { const c = Object.fromEntries(keys.map((k) => [k, "preserves"])); delete (c as any)[keys[0]]; eq((parseFidelityResponse(judgment as any, "en", JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: c })) as any).code, "DICE_CHECKER_CHECKS_KEYS", "missing check key rejected"); }
  { const c: any = Object.fromEntries(keys.map((k) => [k, "preserves"])); c.not_a_key = "preserves"; eq((parseFidelityResponse(judgment as any, "en", JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: c })) as any).code, "DICE_CHECKER_CHECKS_KEYS", "extra check key rejected"); }
  eq((parseFidelityResponse(judgment as any, "zh-Hant", mk()) as any).code, "DICE_CHECKER_LANGUAGE", "wrong language rejected");
  eq((parseFidelityResponse(judgment as any, "en", mk({ answer: "definitely" })) as any).code, "DICE_CHECKER_VERDICT", "non-enum verdict rejected");

  // ---- B03: duplicate JSON keys ------------------------------------------------------------------
  // A NESTED duplicate check key whose earlier value is rejecting must NOT be silently overwritten by a
  // later "preserves". Plain JSON.parse would keep the last; the duplicate-aware parser rejects it.
  const dupNested = mk().replace('"answer":"preserves"', '"answer":"changes","answer":"preserves"');
  const dupNestedParse = parseFidelityResponse(judgment as any, "en", dupNested);
  eq((dupNestedParse as any).code, "DICE_CHECKER_DUPLICATE_KEY", "B03: nested duplicate check key (changes then preserves) rejected");
  eq(fidelityDecision(judgment as any, dupNestedParse), "DICE_CHECKER_DUPLICATE_KEY", "B03: the rejecting decision is not overwritten by the later preserves");
  // A top-level duplicate identity key is rejected too.
  const dupTop = mk().replace('"language":"en"', '"language":"en","language":"en"');
  eq((parseFidelityResponse(judgment as any, "en", dupTop) as any).code, "DICE_CHECKER_DUPLICATE_KEY", "B03: duplicate top-level identity key rejected (even identical)");
  // An ESCAPED-equivalent key spelling that decodes to the same key is a duplicate.
  const dupEscaped = mk().replace('"answer":"preserves"', '"answer":"changes","an\\u0073wer":"preserves"');
  eq((parseFidelityResponse(judgment as any, "en", dupEscaped) as any).code, "DICE_CHECKER_DUPLICATE_KEY", "B03: escaped-equivalent duplicate key ('an\\u0073wer'='answer') rejected");
  // Direct parser unit checks.
  eq(parseJsonRejectDuplicateKeys('{"a":1,"a":2}'), { ok: false, duplicate: true }, "B03: parser flags a top-level duplicate");
  eq(parseJsonRejectDuplicateKeys('{"a":{"b":1,"b":2}}'), { ok: false, duplicate: true }, "B03: parser flags a nested duplicate");
  eq((parseJsonRejectDuplicateKeys('{"a":1,"b":2}') as any).ok, true, "B03: distinct keys parse ok");
  eq((parseJsonRejectDuplicateKeys('{bad') as any).duplicate, false, "B03: a plain syntax error is not reported as a duplicate");

  // ---- B02: request + source binding fingerprint --------------------------------------------------
  // Stable and collision-resistant (SHA-256, 64 hex). Both sides recompute it from server-derived state.
  const fp = candidateFingerprint(judgment as any, copy, components, Q, jLanding);
  eq(candidateFingerprint(judgment as any, copy, components, Q, jLanding), fp, "B02: fingerprint is stable for identical inputs");
  ok(/^[0-9a-f]{64}$/.test(fp), "B02: fingerprint is a 64-hex collision-resistant digest, not an 8-char hash");
  eq(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "B02: SHA-256 matches the FIPS 180-4 test vector for \"abc\"");
  // Each binding dimension changes the fingerprint.
  ok(fp !== candidateFingerprint(judgment as any, { ...copy, headline: copy.headline + " extra." }, components, Q, jLanding), "B02: differs when the displayed candidate text differs");
  ok(fp !== candidateFingerprint(judgmentOpposite as any, copy, components, Q, jLanding), "B02: differs when the SOURCE interpretation differs (same visible text)");
  ok(fp !== candidateFingerprint(judgment as any, copy, components, "A different question?", jLanding), "B02: differs when the question differs");
  ok(fp !== candidateFingerprint(judgment as any, copy, components, Q, L("jupiter", "sagittarius", 2)), "B02: differs when the trusted landing differs");
  ok(fp !== candidateFingerprint(judgment as any, copy, { ...components, watch_out: "Something unrelated." }, Q, jLanding), "B02: differs when the proposed components differ");

  // ---- C06: request-INSTANCE binding --------------------------------------------------------------
  // A fresh server-owned request id distinguishes two executions with BYTE-IDENTICAL content. A verdict
  // minted for request A must not validate for request B, and same-instance revalidation still passes.
  const fpA = candidateFingerprint(judgment as any, copy, components, Q, jLanding, "req_A");
  const fpB = candidateFingerprint(judgment as any, copy, components, Q, jLanding, "req_B");
  ok(fpA !== fpB, "C06: identical content but distinct request ids yield distinct fingerprints");
  ok(fpA !== fp, "C06: adding a request id changes the fingerprint (the content-only binding is preserved when absent)");
  const outcomeA = fidelityOutcomeToWire("en", "judgment", Object.fromEntries(keys.map((k) => [k, "preserves"])) as any, fpA);
  eq(validateCarriedFidelity(outcomeA, judgment as any, "en", copy, components, Q, jLanding, "req_A"), "OK", "C06: a verdict validated under ITS OWN request id is accepted");
  eq(validateCarriedFidelity(outcomeA, judgment as any, "en", copy, components, Q, jLanding, "req_B"), "DICE_CHECKER_BINDING", "C06: a verdict minted for request A is REJECTED under request B (identical content)");

  // Carried-outcome validation (Web boundary, no second call).
  const outcome = fidelityOutcomeToWire("en", "judgment", Object.fromEntries(keys.map((k) => [k, "preserves"])) as any, fp);
  eq(validateCarriedFidelity(outcome, judgment as any, "en", copy, components, Q, jLanding), "OK", "a bound all-preserves carried outcome is accepted");
  eq(validateCarriedFidelity({ ...outcome, fingerprint: "0".repeat(64) }, judgment as any, "en", copy, components, Q, jLanding), "DICE_CHECKER_BINDING", "a verdict bound to a DIFFERENT candidate is rejected (binding)");
  // B02 CORE REPRODUCTION: the SAME verdict + candidate copy, but replayed against a DIFFERENT source
  // interpretation, must be rejected on binding (the review's P02 previously returned OK).
  eq(validateCarriedFidelity(outcome, judgmentOpposite as any, "en", copy, components, Q, jLanding), "DICE_CHECKER_BINDING", "B02: a verdict replayed against a different SOURCE is rejected (no second call)");
  eq(validateCarriedFidelity(outcome, judgment as any, "en", copy, components, "A different question?", jLanding), "DICE_CHECKER_BINDING", "B02: a verdict replayed against a different QUESTION is rejected");
  eq(validateCarriedFidelity(outcome, judgment as any, "en", copy, components, Q, L("jupiter", "sagittarius", 2)), "DICE_CHECKER_BINDING", "B02: a verdict replayed against a different LANDING is rejected");
  eq(validateCarriedFidelity(null, judgment as any, "en", copy, components, Q, jLanding), "DICE_CHECKER_MISSING", "a missing carried outcome is rejected");
  { const short: any = { ...outcome, checks: { ...outcome.checks } }; delete short.checks[keys[0]]; eq(validateCarriedFidelity(short, judgment as any, "en", copy, components, Q, jLanding), "DICE_CHECKER_COVERAGE", "an under-covering carried outcome is rejected on coverage"); }
  // A correctly-bound outcome that carries a real 'changes' verdict is rejected on the VERDICT (the
  // fingerprint binds candidate + source + request, not the verdict values, so a non-preserves verdict
  // is caught by the explicit all-preserves rule, never silently accepted).
  { const chg = fidelityOutcomeToWire("en", "judgment", { ...Object.fromEntries(keys.map((k) => [k, "preserves"])), watch_out: "changes" } as any, candidateFingerprint(judgment as any, copy, components, Q, jLanding)); eq(validateCarriedFidelity(chg, judgment as any, "en", copy, components, Q, jLanding), "DICE_CHECKER_CHANGED", "a correctly-bound 'changes' verdict is rejected on the verdict"); }

  // fidelityComponentsFromWire strips identity keys and matches on both sides.
  const wire = { schema: "lumis_dice_editor_v2", status: "ok", language: "en", question_mode: "judgment", ...components };
  eq(fidelityComponentsFromWire(wire), components, "B02: components extracted from the flat wire match the composition's map");

  // ---- Runner: one bounded attempt ----------------------------------------------------------------
  let calls = 0;
  const adapter = (verdict: "preserves" | "changes" | "bad" | "network"): DiceV05ProviderAdapter => ({
    invoke: async (req: any) => {
      calls += 1;
      if (verdict === "network") return { kind: "network" } as DiceV05ProviderResult;
      if (verdict === "bad") return { kind: "success", content: "{not json" } as any;
      const ks: string[] = req.schema.properties.checks.required;
      return { kind: "success", content: JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: req.schema.properties.language.const, question_mode: req.schema.properties.question_mode.const, checks: Object.fromEntries(ks.map((k) => [k, verdict === "changes" ? (k === WHOLE_DISPLAY_KEY ? "changes" : "preserves") : "preserves"])) }) } as any;
    },
  });
  calls = 0; const rAccept = await runFidelityCheck(judgment as any, copy, components, Q, adapter("preserves"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(rAccept.accepted && rAccept.outcome && rAccept.calls === 1, "runner: all-preserves → accepted, 1 call, outcome carried");
  ok(rAccept.outcome!.fingerprint === candidateFingerprint(judgment as any, copy, components, Q, jLanding), "runner: the outcome is fingerprint-bound to the candidate + source + request");
  calls = 0; const rChanges = await runFidelityCheck(judgment as any, copy, components, Q, adapter("changes"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rChanges.accepted && rChanges.failure === "DICE_CHECKER_CHANGED" && calls === 1, "runner: a 'changes' verdict → rejected, exactly 1 call (no retry)");
  calls = 0; const rBad = await runFidelityCheck(judgment as any, copy, components, Q, adapter("bad"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rBad.accepted && calls === 1, "runner: malformed checker output → rejected, no retry");
  calls = 0; const rNet = await runFidelityCheck(judgment as any, copy, components, Q, adapter("network"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rNet.accepted && rNet.failure === "DICE_CHECKER_NETWORK" && calls === 1, "runner: transport failure → rejected, NO hidden retry");
  calls = 0; const rSkip = await runFidelityCheck(judgment as any, copy, components, Q, adapter("preserves"), { now: () => 5000, deadlineAtMs: 4000, landing: jLanding });
  ok(!rSkip.accepted && rSkip.failure === "DICE_CHECKER_SKIPPED_TIMEOUT" && calls === 0, "runner: expired shared deadline → ZERO checker transport, skipped (never passed)");
  calls = 0; const rBig = await runFidelityCheck(judgment as any, copy, components, "x ".repeat(6000), adapter("preserves"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rBig.accepted && rBig.failure === "DICE_CHECKER_INPUT_TOO_LARGE" && calls === 0, "runner: over-cap comparison input → controlled fallback, no truncation, no call");

  // ---- B06: a completion that only settles AFTER the deadline is NOT accepted ---------------------
  // Controlled clock: start 1000, deadline 2000; the adapter advances the clock to 3000 before it
  // returns a well-formed all-preserves verdict. The runner must reject (late), not accept.
  {
    let clock = 1000;
    const lateAdapter: DiceV05ProviderAdapter = { invoke: async (req: any) => { clock = 3000; const ks: string[] = req.schema.properties.checks.required; return { kind: "success", content: JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: req.schema.properties.language.const, question_mode: req.schema.properties.question_mode.const, checks: Object.fromEntries(ks.map((k) => [k, "preserves"])) }) } as any; } };
    const late = await runFidelityCheck(judgment as any, copy, components, Q, lateAdapter, { now: () => clock, deadlineAtMs: 2000, landing: jLanding });
    ok(!late.accepted && late.failure === "DICE_CHECKER_TIMEOUT", "B06: a verdict that settles after the absolute deadline is rejected (not accepted)");
    ok(late.calls === 1, "B06: the late transported call is still honestly counted");
  }
  // Preprocessing that itself exhausts the budget: deadline passes exactly at/after input construction.
  {
    const times = [1500, 2500]; let i = 0; // first read (initial guard) ok; second read (post-build) expired
    const neverAdapter: DiceV05ProviderAdapter = { invoke: async () => { throw new Error("must not be called"); } };
    const r = await runFidelityCheck(judgment as any, copy, components, Q, neverAdapter, { now: () => times[Math.min(i++, times.length - 1)], deadlineAtMs: 2000, landing: jLanding });
    ok(!r.accepted && r.failure === "DICE_CHECKER_SKIPPED_TIMEOUT" && r.calls === 0, "B06: budget exhausted during preprocessing → skipped before transport, zero calls");
  }

  // ---- C01: strict parse — forbidden props (incl. __proto__) + JSON number grammar ---------------
  // A valid all-preserves response, then four strict-contract bypass attempts the review reproduced.
  const validResp = () => JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: Object.fromEntries(keys.map((k) => [k, "preserves"])) });
  const attacks: Record<string, string> = {
    topProto: validResp().replace("{", '{"__proto__":{},'),
    nestedProto: validResp().replace('"checks":{', '"checks":{"__proto__":{},'),
    escapedProto: validResp().replace("{", '{"\\u005f_proto__":{},'),
    invalidNumber: validResp().replace("{", '{"__proto__":01,'),
    bareInvalidNumber: validResp().replace('"preserves"', "01"),  // 01 as a check value: invalid JSON grammar
    unknownKey: validResp().replace("{", '{"extra":1,'),
  };
  for (const [name, raw] of Object.entries(attacks)) {
    const p = parseFidelityResponse(judgment as any, "en", raw);
    ok(p.kind === "invalid", `C01: ${name} is rejected by parseFidelityResponse (kind=${(p as any).kind})`);
    let calls2 = 0;
    const run = await runFidelityCheck(judgment as any, copy, components, Q, { invoke: async () => { calls2 += 1; return { kind: "success", content: raw, transported: true } as any; } }, { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
    ok(!run.accepted, `C01: ${name} produces NO accepted outcome through runFidelityCheck`);
    ok(calls2 === 1, `C01: ${name} makes exactly one checker attempt (no retry)`);
  }
  // parseJsonRejectDuplicateKeys directly: __proto__ becomes an own key (visible to exact-key checks);
  // 01/1./-.1 are rejected as grammar; a genuine duplicate is still a duplicate.
  { const d = parseJsonRejectDuplicateKeys('{"__proto__":{},"a":1}'); ok(d.ok === true && Object.prototype.hasOwnProperty.call((d as any).value, "__proto__"), "C01: __proto__ is materialised as an OWN key by native JSON.parse (not the prototype setter)"); }
  ok(parseJsonRejectDuplicateKeys('{"a":01}').ok === false, "C01: leading-zero number 01 is rejected (JSON grammar)");
  ok(parseJsonRejectDuplicateKeys('{"a":1.}').ok === false, "C01: trailing-dot number 1. is rejected");
  ok(parseJsonRejectDuplicateKeys('{"a":-.1}').ok === false, "C01: -.1 is rejected");
  eq(parseJsonRejectDuplicateKeys('{"a":1,"a":2}'), { ok: false, duplicate: true }, "C01: a genuine duplicate is still flagged");

  // ---- C02: the await is bounded even when the adapter IGNORES abort and never settles -------------
  {
    let invoked = false, aborted = false;
    const start = Date.now();
    const neverSettles: DiceV05ProviderAdapter = { invoke: async (req: any) => { invoked = true; req.signal?.addEventListener?.("abort", () => { aborted = true; }); return new Promise(() => {}); } };
    const run = await runFidelityCheck(judgment as any, copy, components, Q, neverSettles, { deadlineAtMs: start + 40, landing: jLanding });
    const elapsed = Date.now() - start;
    ok(!run.accepted && run.failure === "DICE_CHECKER_TIMEOUT", "C02: a never-settling adapter → controlled timeout (the runner does NOT hang)");
    ok(invoked && aborted, "C02: the request was invoked and the abort signal fired");
    ok(elapsed < 2000, `C02: the runner returned promptly at the deadline (elapsed=${elapsed}ms), not hung`);
    ok(run.calls === 1, "C02: an in-flight-at-deadline request is counted as one transported call");
  }
  // A pre-transport rejection with transported:false is counted as zero calls.
  { let c = 0; const run = await runFidelityCheck(judgment as any, copy, components, Q, { invoke: async () => { c += 1; return { kind: "network", transported: false } as any; } }, { now: () => 1000, deadlineAtMs: 20000, landing: jLanding }); ok(!run.accepted && run.calls === 0 && c === 1, "C02: a pre-transport rejection (transported:false) is zero transported calls, one attempt"); }
  // A late REJECTION after timeout must not surface as an unhandled rejection or change the decision.
  {
    const start = Date.now();
    const lateReject: DiceV05ProviderAdapter = { invoke: async () => new Promise((_res, rej) => setTimeout(() => rej(new Error("late transport error")), 60)) };
    const run = await runFidelityCheck(judgment as any, copy, components, Q, lateReject, { deadlineAtMs: start + 25, landing: jLanding });
    ok(!run.accepted && run.failure === "DICE_CHECKER_TIMEOUT", "C02: a late rejection after the deadline does not change the returned timeout decision");
    await new Promise((r) => setTimeout(r, 80)); // allow the late rejection to fire; the attached catch swallows it
  }

  // ---- C04-A: an upstream SERVER / rate-limit failure is transport, not invalid checker content ----
  { let c = 0; const run = await runFidelityCheck(judgment as any, copy, components, Q, { invoke: async () => { c += 1; return { kind: "server", transported: true } as any; } }, { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
    ok(!run.accepted && run.failure === "DICE_CHECKER_SERVER" && c === 1, "C04-A: an adapter kind:'server' (HTTP 429/5xx) → DICE_CHECKER_SERVER, one attempt, no retry");
  }

  // ---- B07 + C05: largest legal verdict envelope + input per mode/language ------------------------
  // The verdict envelope's size is driven mainly by the number of required check keys (ASCII keys + ASCII
  // enum values), but it is NOT strictly language-independent: the `language` field value ("en" vs
  // "zh-Hant") occupies a couple of extra tokens (C05 — e.g. judgment 86 EN vs 88 zh-Hant), so it is
  // measured for BOTH languages of EVERY mode below. The verdict tokens are measured with the production
  // tokenizer on the maximum-key envelope at the longest enum value ("uncertain"); the raw runtime cap
  // already rejects arbitrary whitespace padding, and the visible JSON has no free-form fields, so the
  // key×enum maximum is the legal maximum. The INPUT measurement here is REPRESENTATIVE (a maximal-key
  // canonical with short component placeholders + a representative question), not a cap-saturated worst
  // case; the over-cap → no-checker-call fallback is proved separately by the `rBig` test above.
  type Row = { mode: DiceV05Mode; language: DiceV05Language; canonical: any; landing: Landing };
  const maxRows: Row[] = [
    { mode: "judgment", language: "en", landing: L("jupiter", "sagittarius", 1), canonical: {
      ...judgment, watch_out: "Keep optimism realistic even with strong support, and do not overcommit early.",
      suggested_followups: ["What should I prepare first?", "Who should I involve early on?", "What would make me reconsider this?"] } },
    { mode: "judgment", language: "zh-Hant", landing: L("jupiter", "sagittarius", 1), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "judgment",
      planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護", strength: "strong", constructive_traits: "慷慨", difficult_traits: "浪費", dignity_emphasis: "constructive", prose: "木星在這裡是強而有力的吉星，主動而有信心地推動事情。" },
      house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: "第一宮把事情牢牢放在你自己手上，環境相當支持。" },
      most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "兩邊都各自有利，並沒有互相抵消，所以整體形勢是支持的。", timing_summary: null,
      watch_out: "在有支持的時候，也要保持務實，不要太早過度承諾。", practical_step: null,
      suggested_followups: ["我應該先準備甚麼？", "應該及早找誰參與？", "甚麼情況會讓我重新考慮？"] } },
    { mode: "timing", language: "en", landing: L("saturn", "capricorn", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "timing",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "The matter needs time to develop, though the present setting helps move it along a little faster than its own slow pace.",
      timing_summary: "The pace is moderate: not immediate, but not stalled for long either.",
      watch_out: "Do not force an early result before the groundwork is in place.", practical_step: null, suggested_followups: [] } },
    { mode: "timing", language: "zh-Hant", landing: L("saturn", "capricorn", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "timing",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "事情本身需要較長時間處理，不過目前的環境有助推動進度，所以整體會比原本的慢節奏快一些。", timing_summary: "進度屬於中等，不會即時有結果，但亦不會長期停滯。",
      watch_out: "在基礎未穩之前，不要勉強追求太早的結果。", practical_step: null, suggested_followups: [] } },
    { mode: "location", language: "en", landing: L("moon", "cancer", 4), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "location",
      planet_side: null, house_side: null, most_likely_area: "Most likely a quiet, everyday storage spot at home.",
      location_candidates: [
        { rank: 1, place: "the bedroom", evidence: { planet_ids: ["planet.moon.related.bedroom"], house_ids: [], element_ids: [] } },
        { rank: 2, place: "the kitchen", evidence: { planet_ids: [], house_ids: ["house.4.related.kitchen"], element_ids: [] } },
        { rank: 3, place: "the living room", evidence: { planet_ids: [], house_ids: ["house.4.related.living"], element_ids: [] } },
        { rank: 4, place: "the hallway cupboard", evidence: { planet_ids: [], house_ids: ["house.4.related.storage"], element_ids: [] } },
      ],
      location_extension: null, location_search_order: [1, 2, 3, 4],
      synthesis: "The Moon points to a private, domestic setting, so begin indoors where daily items are kept and rarely disturbed.",
      timing_summary: null, watch_out: "Do not assume it is permanently lost before a careful look.",
      practical_step: "Start with the bedroom, then check the kitchen, then the living room, then the hallway cupboard.", suggested_followups: [] } },
    { mode: "person", language: "en", landing: L("saturn", "taurus", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "person",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "This person is careful and practical, and tends to build trust slowly through consistent, dependable actions over time.",
      timing_summary: null, watch_out: "They may seem reserved and slow to open up before they feel settled.",
      practical_step: "Give them clear, concrete information and time, rather than pressure.", suggested_followups: [] } },
    { mode: "reason", language: "en", landing: L("saturn", "taurus", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "reason",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "The cause is most likely a practical, structural constraint that built up gradually rather than a sudden or emotional trigger.",
      timing_summary: null, watch_out: "Do not assume a single dramatic cause when steady pressure is the better explanation.",
      practical_step: "Look for the slow, concrete factors first before considering anything sudden.", suggested_followups: [] } },
    { mode: "thing_or_situation", language: "en", landing: L("saturn", "taurus", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "thing_or_situation",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "The situation is stable and durable but slow to change, favouring patience and steady maintenance over rapid moves.",
      timing_summary: null, watch_out: "Do not expect a quick turnaround; forcing it risks undoing the stability.",
      practical_step: "Consolidate what already works before attempting any large change.", suggested_followups: [] } },
    // C05: the four missing zh-Hant rows so every mode is measured in BOTH languages.
    { mode: "location", language: "zh-Hant", landing: L("moon", "cancer", 4), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "location",
      planet_side: null, house_side: null, most_likely_area: "最有可能在家中一個安靜、常放日常物品的位置。",
      location_candidates: [
        { rank: 1, place: "睡房", evidence: { planet_ids: ["planet.moon.related.bedroom"], house_ids: [], element_ids: [] } },
        { rank: 2, place: "廚房", evidence: { planet_ids: [], house_ids: ["house.4.related.kitchen"], element_ids: [] } },
        { rank: 3, place: "客廳", evidence: { planet_ids: [], house_ids: ["house.4.related.living"], element_ids: [] } },
        { rank: 4, place: "走廊的櫃", evidence: { planet_ids: [], house_ids: ["house.4.related.storage"], element_ids: [] } },
      ],
      location_extension: null, location_search_order: [1, 2, 3, 4],
      synthesis: "月亮指向一個私密的居家位置，所以先由室內、日常擺放物品而少受打擾的地方開始。",
      timing_summary: null, watch_out: "在仔細找之前，不要假設東西已經永久不見了。",
      practical_step: "先由睡房開始，然後檢查廚房，再看客廳，最後看走廊的櫃。", suggested_followups: [] } },
    { mode: "person", language: "zh-Hant", landing: L("saturn", "taurus", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "person",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "這個人小心務實，會透過穩定可靠的行動，慢慢建立起別人的信任。",
      timing_summary: null, watch_out: "在安定下來之前，他們可能顯得內斂而慢熱。",
      practical_step: "給他們清楚具體的資料和時間，而不是施壓。", suggested_followups: [] } },
    { mode: "reason", language: "zh-Hant", landing: L("saturn", "taurus", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "reason",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "原因很可能是一種逐步累積的實際、結構性限制，而不是突然或情緒化的觸發。",
      timing_summary: null, watch_out: "當持續的壓力更能解釋時，不要假設只有一個戲劇性的原因。",
      practical_step: "先看那些緩慢而具體的因素，然後才考慮任何突發的情況。", suggested_followups: [] } },
    { mode: "thing_or_situation", language: "zh-Hant", landing: L("saturn", "taurus", 6), canonical: {
      schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "thing_or_situation",
      planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
      synthesis: "情況穩定持久，但改變得慢，比較適合耐心和穩定維持，多於急進的行動。",
      timing_summary: null, watch_out: "不要期望快速逆轉；勉強推動會危及原有的穩定。",
      practical_step: "在嘗試任何大改動之前，先鞏固已經行得通的部分。", suggested_followups: [] } },
  ];
  for (const row of maxRows) {
    eq(validateDiceV05FinalResult(row.canonical), "OK", `B07: max-legal ${row.mode}/${row.language} canonical is a valid final`);
    const rowCopy = deterministicCustomerCopy(row.canonical);
    const rowKeys = fidelityCheckKeys(row.canonical);
    // Largest legal verdict = every required check at the LONGEST enum value ("uncertain").
    const largest = JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: row.language, question_mode: row.mode, checks: Object.fromEntries(rowKeys.map((k) => [k, "uncertain"])) });
    const vTok = measureDiceTokenLimit(largest, CHECKER_OUTPUT_CAP);
    ok(vTok.within_limit, `B07: ${row.mode}/${row.language} largest verdict (${rowKeys.length} keys) within CHECKER_OUTPUT_CAP=${CHECKER_OUTPUT_CAP} (tokens=${vTok.token_count})`);
    // The comparison INPUT at this max canonical stays within the input cap (never truncated).
    const rowComponents = fidelityComponentsFromWire({ schema: "lumis_dice_editor_v2", status: "ok", language: row.language, question_mode: row.mode, ...Object.fromEntries(rowKeys.filter((k) => k !== WHOLE_DISPLAY_KEY).map((k) => [k, "x"])) });
    const rowInput = buildFidelityProviderInput(buildFidelityInput(row.canonical, rowCopy, rowComponents, row.language === "en" ? "A representative maximal question for measurement?" : "一個用於量度的代表性最長問題？", row.landing));
    const iTok = measureDiceTokenLimit(rowInput, CHECKER_INPUT_CAP);
    ok(iTok.within_limit, `B07: ${row.mode}/${row.language} max comparison input within CHECKER_INPUT_CAP=${CHECKER_INPUT_CAP} (tokens=${iTok.token_count})`);
    console.log(`checker-io ${row.mode}/${row.language}: keys=${rowKeys.length} verdict_tokens=${vTok.token_count} cap=${CHECKER_OUTPUT_CAP}; input_tokens=${iTok.token_count} cap=${CHECKER_INPUT_CAP}; generation_allowance=${CHECKER_GEN_CAP}`);
  }

  console.log("dice-v0-5 copy-fidelity (Stage 4 meaning checker) fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
