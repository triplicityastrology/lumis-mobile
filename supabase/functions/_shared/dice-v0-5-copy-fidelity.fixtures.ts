/** Stage-4 meaning-checker — unit fixtures (node-runnable; MOCK adapter, no network). Verifies the
 * server-determined required check keys, the strict mode-aware output schema, the strict parse, the
 * SERVER acceptance rule (accept iff every required check is "preserves"), the request-local binding
 * fingerprint, the carried-outcome validation used at the Web boundary, and the one-attempt bounded
 * runner (accept / changes-reject / malformed-reject / timeout-skip / transport-reject / input-too-large
 * / no-retry). MOCK verdicts prove HANDLING and WIRING only — NOT that a real checker detects semantic
 * errors; that is the deferred live evaluation. */
import {
  DICE_V05_FIDELITY_SCHEMA, DICE_V05_FIDELITY_BLOCK, WHOLE_DISPLAY_KEY,
  fidelityCheckKeys, buildFidelitySchema, buildFidelityInput, buildFidelityProviderInput,
  parseFidelityResponse, fidelityDecision, candidateFingerprint, assembledVisibleText,
  validateCarriedFidelity, fidelityOutcomeToWire, runFidelityCheck,
  CHECKER_OUTPUT_CAP, CHECKER_GEN_CAP, CHECKER_INPUT_CAP,
} from "./dice-v0-5-copy-fidelity.ts";
import { deterministicCustomerCopy, type DiceV05CustomerCopy, type Landing } from "./dice-v0-5-customer-copy.ts";
import { validateDiceV05FinalResult } from "./dice-v0-5-interpretation-contract.ts";
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

async function main() {
  // Required keys = every editable component (minus pace_band) + whole_display.
  const keys = fidelityCheckKeys(judgment as any);
  ok(keys.includes("answer") && keys.includes("planet_factor") && keys.includes("house_factor") && keys.includes("synthesis") && keys.includes("watch_out") && keys.includes("followup_1") && keys.includes(WHOLE_DISPLAY_KEY), "required keys cover every edited component + whole_display");

  // Schema: closed, identity pinned, checks required = keys, verdict enum.
  const schema: any = buildFidelitySchema(judgment as any, "en");
  eq(schema.additionalProperties, false, "schema closed at top level");
  eq(schema.properties.checks.additionalProperties, false, "checks object closed");
  eq(schema.properties.fidelity_schema.const, DICE_V05_FIDELITY_SCHEMA, "checker schema id pinned");
  eq(schema.properties.language.const, "en", "language pinned"); eq(schema.properties.question_mode.const, "judgment", "mode pinned");
  eq(schema.properties.checks.required.slice().sort(), keys.slice().sort(), "checks required = the server-determined keys");
  eq(schema.properties.checks.properties.whole_display.enum, ["preserves", "changes", "uncertain"], "each check is a preserves/changes/uncertain enum");

  // Input: server-built, carries source + facts + proposed + exact assembled display + mapping; the
  // prompt is data-safe. No astrology instruction is added beyond the fixed block.
  const input = buildFidelityInput(judgment as any, copy, components, "Should I accept this promotion?", jLanding);
  ok(input.fidelity_schema === DICE_V05_FIDELITY_SCHEMA && input.language === "en" && input.question_mode === "judgment", "input identity");
  ok(input.source.planet_factor && input.source.house_factor && input.source.synthesis && input.source.watch_out, "input carries the source meaning-bearing fields");
  ok((input.proposed as any).answer && (input.proposed as any).assembled_headline, "input carries the proposed components + assembled visible fields");
  ok(input.assembled_display === assembledVisibleText(copy), "input carries the exact assembled customer-visible text");
  ok(Array.isArray(input.required_checks) && input.required_checks.includes(WHOLE_DISPLAY_KEY), "input names the required checks incl whole_display");
  const providerInput = buildFidelityProviderInput(input);
  ok(providerInput.startsWith(DICE_V05_FIDELITY_BLOCK), "provider input begins with the fixed checker block");

  // Parse: a valid all-preserves response parses; the decision is OK.
  const mk = (over: Record<string, string> = {}) => JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: Object.fromEntries(keys.map((k) => [k, over[k] ?? "preserves"])) });
  const good = parseFidelityResponse(judgment as any, "en", mk());
  eq(good.kind, "ok", "valid all-preserves response parses");
  eq(fidelityDecision(judgment as any, good), "OK", "server acceptance: all preserves → OK");

  // Server acceptance rule: any single changes/uncertain rejects.
  eq(fidelityDecision(judgment as any, parseFidelityResponse(judgment as any, "en", mk({ watch_out: "changes" }))), "DICE_CHECKER_CHANGED", "a single 'changes' rejects");
  eq(fidelityDecision(judgment as any, parseFidelityResponse(judgment as any, "en", mk({ [WHOLE_DISPLAY_KEY]: "uncertain" }))), "DICE_CHECKER_UNCERTAIN", "a single 'uncertain' rejects");

  // Strict parse: malformed JSON, extra/missing/duplicate keys, wrong identity, bad enum.
  eq(parseFidelityResponse(judgment as any, "en", "{ not json").kind, "invalid", "malformed JSON rejected");
  eq((parseFidelityResponse(judgment as any, "en", JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: Object.fromEntries(keys.map((k) => [k, "preserves"])), extra: 1 })) as any).code, "DICE_CHECKER_EXTRA_OR_MISSING_KEY", "extra top-level key rejected");
  { const c = Object.fromEntries(keys.map((k) => [k, "preserves"])); delete (c as any)[keys[0]]; eq((parseFidelityResponse(judgment as any, "en", JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: c })) as any).code, "DICE_CHECKER_CHECKS_KEYS", "missing check key rejected"); }
  { const c: any = Object.fromEntries(keys.map((k) => [k, "preserves"])); c.not_a_key = "preserves"; eq((parseFidelityResponse(judgment as any, "en", JSON.stringify({ fidelity_schema: DICE_V05_FIDELITY_SCHEMA, language: "en", question_mode: "judgment", checks: c })) as any).code, "DICE_CHECKER_CHECKS_KEYS", "extra check key rejected"); }
  eq((parseFidelityResponse(judgment as any, "zh-Hant", mk()) as any).code, "DICE_CHECKER_LANGUAGE", "wrong language rejected");
  eq((parseFidelityResponse(judgment as any, "en", mk({ answer: "definitely" })) as any).code, "DICE_CHECKER_VERDICT", "non-enum verdict rejected");

  // Fingerprint: stable + differs when the visible text differs.
  eq(candidateFingerprint("en", "judgment", copy), candidateFingerprint("en", "judgment", copy), "fingerprint is stable");
  ok(candidateFingerprint("en", "judgment", copy) !== candidateFingerprint("en", "judgment", { ...copy, headline: copy.headline + " extra." }), "fingerprint differs when the displayed text differs");

  // Carried-outcome validation (Web boundary, no second call): OK; binding mismatch; coverage; missing; non-preserves.
  const fp = candidateFingerprint("en", "judgment", copy);
  const outcome = fidelityOutcomeToWire("en", "judgment", Object.fromEntries(keys.map((k) => [k, "preserves"])) as any, fp);
  eq(validateCarriedFidelity(outcome, judgment as any, "en", copy), "OK", "a bound all-preserves carried outcome is accepted");
  eq(validateCarriedFidelity({ ...outcome, fingerprint: "deadbeef" }, judgment as any, "en", copy), "DICE_CHECKER_BINDING", "a verdict bound to a DIFFERENT candidate is rejected (binding)");
  eq(validateCarriedFidelity({ ...outcome, checks: { ...outcome.checks, watch_out: "changes" } }, judgment as any, "en", copy), "DICE_CHECKER_CHANGED", "a carried 'changes' verdict is rejected");
  eq(validateCarriedFidelity(null, judgment as any, "en", copy), "DICE_CHECKER_MISSING", "a missing carried outcome is rejected");
  { const short: any = { ...outcome, checks: { ...outcome.checks } }; delete short.checks[keys[0]]; eq(validateCarriedFidelity(short, judgment as any, "en", copy), "DICE_CHECKER_COVERAGE", "an under-covering carried outcome is rejected"); }

  // Runner (one bounded attempt): accept; changes → reject; malformed → reject; timeout skip; transport;
  // input-too-large; and it makes AT MOST one call (no retry).
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
  calls = 0; const rAccept = await runFidelityCheck(judgment as any, copy, components, "q", adapter("preserves"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(rAccept.accepted && rAccept.outcome && rAccept.calls === 1, "runner: all-preserves → accepted, 1 call, outcome carried");
  ok(rAccept.outcome!.fingerprint === candidateFingerprint("en", "judgment", copy), "runner: the outcome is fingerprint-bound to the candidate");
  calls = 0; const rChanges = await runFidelityCheck(judgment as any, copy, components, "q", adapter("changes"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rChanges.accepted && rChanges.failure === "DICE_CHECKER_CHANGED" && calls === 1, "runner: a 'changes' verdict → rejected, exactly 1 call (no retry)");
  calls = 0; const rBad = await runFidelityCheck(judgment as any, copy, components, "q", adapter("bad"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rBad.accepted && calls === 1, "runner: malformed checker output → rejected, no retry");
  calls = 0; const rNet = await runFidelityCheck(judgment as any, copy, components, "q", adapter("network"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rNet.accepted && rNet.failure === "DICE_CHECKER_NETWORK" && calls === 1, "runner: transport failure → rejected, NO hidden retry");
  calls = 0; const rSkip = await runFidelityCheck(judgment as any, copy, components, "q", adapter("preserves"), { now: () => 5000, deadlineAtMs: 4000, landing: jLanding });
  ok(!rSkip.accepted && rSkip.failure === "DICE_CHECKER_SKIPPED_TIMEOUT" && calls === 0, "runner: expired shared deadline → ZERO checker transport, skipped (never passed)");
  // Input too large → controlled fallback, not truncation. A giant question blows the input cap.
  calls = 0; const rBig = await runFidelityCheck(judgment as any, copy, components, "x ".repeat(6000), adapter("preserves"), { now: () => 1000, deadlineAtMs: 20000, landing: jLanding });
  ok(!rBig.accepted && rBig.failure === "DICE_CHECKER_INPUT_TOO_LARGE" && calls === 0, "runner: over-cap comparison input → controlled fallback, no truncation, no call");

  // Recorded bounds (measured with the production tokenizer), not merely "within budget".
  const largestVerdict = mk(Object.fromEntries(keys.map((k) => [k, "uncertain"])));
  const verdictTokens = measureDiceTokenLimit(largestVerdict, CHECKER_OUTPUT_CAP);
  ok(verdictTokens.within_limit, `largest legal verdict envelope within CHECKER_OUTPUT_CAP=${CHECKER_OUTPUT_CAP} (tokens=${verdictTokens.token_count})`);
  const inTokens = measureDiceTokenLimit(providerInput, CHECKER_INPUT_CAP).token_count;
  console.log(`checker-io judgment: verdict_tokens=${verdictTokens.token_count} cap=${CHECKER_OUTPUT_CAP}; input_tokens=${inTokens} cap=${CHECKER_INPUT_CAP}; generation_allowance=${CHECKER_GEN_CAP} (reasoning-aware, not a visible bound)`);

  console.log("dice-v0-5 copy-fidelity (Stage 4 meaning checker) fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
