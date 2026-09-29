/** Stage-3 customer-language editor — unit fixtures (node-runnable; MOCK adapter, no network).
 * Verifies the customer-copy schema (one closed object with a status enum), Stage-2→Stage-3
 * mapping, strict parse with the status-conditional contract, prohibited-language, complete-ending
 * heuristic, structural preservation, source parity, the shared display-validation path, execution
 * (stage3 / validated fallback / controlled unavailable), the single end-to-end deadline, and the
 * production-tokenizer max-sample envelope measurement. The customer question is sent inside the
 * Stage-3 provider input; it is not logged, persisted, or emitted in evidence here. */
import {
  DICE_V05_CUSTOMER_COPY_SCHEMA, DICE_V05_EDITOR_SCHEMA, CUSTOMER_COPY_UNAVAILABLE_MESSAGE,
  buildEditorSchema, buildEditorInput, editorSchemaName, parseEditorResponse, assembleEditorCopy, parseCustomerCopy,
  prohibitedLanguageCheck, completenessCheck, preservationCheck, sourceParityCheck, deterministicCustomerCopy,
  validateDisplayCopy, buildValidatedFallback, canonicalProseComplete, executeDiceV05CustomerCopy, COPY_CAPS, CUSTOMER_COPY_OUTPUT_CAP,
  DICE_V05_EDITOR_BLOCK, meaningContradictionCheck,
  type DiceV05CustomerCopy, type Landing,
} from "./dice-v0-5-customer-copy.ts";
import { validateDiceV05FinalResult, type DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";
import { buildTimingEnvelope } from "./dice-v0-5-presentation.ts";
import type { DiceV05ProviderAdapter, DiceV05ProviderResult } from "./dice-v0-5-window.ts";
import type { DiceV05PlanetId, DiceV05SignId } from "./dice-v0-5-fixed-data.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }
// Build a status-"ok" DISPLAY copy object (adds status + schema so display-validator tests stay terse).
const copyOk = (o: Partial<DiceV05CustomerCopy> & Pick<DiceV05CustomerCopy, "language" | "question_mode" | "headline" | "reading">): DiceV05CustomerCopy =>
  Object.freeze({ schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", watch_out: null, practical_step: null, suggested_followups: [], ...o });
// Build a status-"ok" structured EDITOR response (the provider's per-mode components) as a JSON string.
const editorOk = (language: "en" | "zh-Hant", mode: DiceV05Mode, components: Record<string, string>): string =>
  JSON.stringify({ schema: DICE_V05_EDITOR_SCHEMA, status: "ok", language, question_mode: mode, ...components });
// RG2: the editor response must now also carry the CONTROLLED components (watch_out / practical_step /
// followup_1..N) whenever the canonical carries them. For any the caller did not supply, this auto-fills
// the canonical value VERBATIM — a maximally faithful stand-in — so tests whose FOCUS is elsewhere stay
// valid without accidentally changing meaning (independent-review correction #3: generic filler could
// erase meaning even in a "positive" test, and the source-relative guards would then reject it). Tests
// that specifically exercise a controlled-field EDIT (or an adversarial one) supply that key explicitly.
const rankedCands = (canonical: any): any[] => [...(canonical.location_candidates ?? [])].filter((x: any) => x && x.place != null).sort((a: any, b: any) => (a?.rank ?? 0) - (b?.rank ?? 0));
const withControlled = (canonical: any, components: Record<string, string>): Record<string, string> => {
  const filled: Record<string, string> = { ...components };
  const zh = canonical.language === "zh-Hant";
  if (canonical.watch_out != null && !("watch_out" in filled)) filled.watch_out = String(canonical.watch_out);
  if (canonical.practical_step != null) {
    const cands = rankedCands(canonical);
    if (canonical.question_mode === "location" && cands.length > 0) {
      // R02: per-candidate search phrases; auto-fill a faithful "search <place>" for any not supplied.
      for (let i = 0; i < cands.length; i += 1) { const k = `search_step_${i + 1}`; if (!(k in filled)) filled[k] = zh ? `搵${cands[i].place}` : `Search ${cands[i].place}`; }
    } else if (!("practical_step" in filled)) {
      filled.practical_step = String(canonical.practical_step);
    }
  }
  const nf = Array.isArray(canonical.suggested_followups) ? canonical.suggested_followups.length : 0;
  for (let i = 0; i < nf; i += 1) {
    const key = `followup_${i + 1}`;
    if (!(key in filled)) filled[key] = String(canonical.suggested_followups[i]);
  }
  return filled;
};
const editorUnpresentable = (language: "en" | "zh-Hant", mode: DiceV05Mode, keys: readonly string[]): string =>
  JSON.stringify({ schema: DICE_V05_EDITOR_SCHEMA, status: "unpresentable", language, question_mode: mode, ...Object.fromEntries(keys.map((k) => [k, null])) });
const L = (planet: string, sign: string, house: number): Landing => ({ planet: planet as DiceV05PlanetId, sign: sign as DiceV05SignId, house });
const paceFor = (l: Landing): string => (buildTimingEnvelope("en", "", l.planet, l.sign, l.house).given as Record<string, unknown>).combined_pace as string;
// Mirror of the module's ensureTerminal (adds a full stop when a field has no terminal punctuation).
const ensureTerminalLike = (s: string): string => {
  const t = String(s).trim();
  return /[.!?。！？…]["'”』」）)\]]?\s*$/u.test(t) ? t : t + ".";
};

/* ---- representative, schema-valid canonical Stage-2 finals (§12.4) ---- */
const judgmentCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "judgment",
  planet_side: { fortune: "minor_malefic", fortune_zh: "小凶星", dignity: "detriment", dignity_zh: "陷", strength: "weak",
    constructive_traits: "主動、果斷", difficult_traits: "急躁、衝動", dignity_emphasis: "difficult",
    prose: "火星這一面較為困難：處理方式若太急或太強硬，容易帶來磨擦。" },
  house_side: { fortune: "fortune", fortune_zh: "吉", rank: 4, prose: "第七宮的外在條件對這件事較為有利，對方有合作空間。" },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "整體而言，外在環境有利，但你這邊的處理方式會明顯影響結果。", timing_summary: null,
  watch_out: "留意跟進時的語氣，不要催逼對方。", practical_step: null, suggested_followups: ["我可以點樣改善溝通？"],
});
const timingCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "timing",
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "事情本身需要較長時間處理，不過目前的環境有助推動進度，所以整體會比原本的慢節奏快一些。", timing_summary: "進度屬於中等，不會即時有結果，但亦不會長期停滯。",
  watch_out: null, practical_step: null, suggested_followups: [],
});
const locationCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "location",
  planet_side: null, house_side: null,
  most_likely_area: "Most likely a quiet storage spot at home.",
  location_candidates: [
    { rank: 1, place: "the bedroom", evidence: { planet_ids: ["planet.moon.related.bedroom"], house_ids: [], element_ids: [] } },
    { rank: 2, place: "the kitchen", evidence: { planet_ids: [], house_ids: ["house.4.related.kitchen"], element_ids: [] } },
  ],
  location_extension: null, location_search_order: [1, 2],
  synthesis: "The Moon points to a private, domestic setting, so begin indoors where daily items are kept.",
  timing_summary: null, watch_out: "Do not assume it is permanently lost.", practical_step: "Start with the bedroom, then check the kitchen.", suggested_followups: [],
});
const personCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "person",
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "This person is careful and practical, and tends to build trust slowly through consistent, dependable actions.",
  timing_summary: null, watch_out: "They may seem reserved before they feel settled.", practical_step: "Give them clear, concrete information rather than pressure.", suggested_followups: [],
});
for (const [n, c] of [["judgment", judgmentCanonical], ["timing", timingCanonical], ["location", locationCanonical], ["person", personCanonical]] as const) {
  eq(validateDiceV05FinalResult(c as any), "OK", `canonical ${n} is a valid §12.4 final`);
}
// Trusted physical landings for each canonical (as the request/composition supplies them). Only the
// TIMING landing is consumed by the editor assembly (authoritative pace); the others are passed but
// unused by their mode. The timing landing is chosen to resolve to a NON-fast band so the immediacy
// guard is meaningful, matching the medium-pace timing canonical.
const judgmentLanding = L("mars", "aries", 7);
const timingLanding = L("jupiter", "cancer", 6);
const locationLanding = L("moon", "cancer", 4);
const personLanding = L("venus", "taurus", 7);

async function main() {
/* ---- structured editor schema: one closed object per mode, required component keys (M02) ---- */
const jSchema: any = buildEditorSchema(judgmentCanonical as any, "zh-Hant");
eq(jSchema.additionalProperties, false, "editor schema closed");
ok(jSchema.required.includes("status") && jSchema.required.includes("planet_factor") && jSchema.required.includes("house_factor") && jSchema.required.includes("synthesis"), "judgment editor requires both factors + synthesis");
eq(jSchema.properties.status, { enum: ["ok", "unpresentable"] }, "status is an ok|unpresentable enum");
eq(jSchema.properties.schema.const, DICE_V05_EDITOR_SCHEMA, "editor schema id pinned");
ok(Array.isArray(jSchema.properties.planet_factor.anyOf), "components nullable in the editor schema (unpresentable representable)");
// RG2: because judgmentCanonical carries a caution and one follow-up, the editor schema also requires
// those controlled components — the editor language-improves them (present iff canonical present).
ok(jSchema.required.includes("watch_out") && jSchema.required.includes("followup_1") && !jSchema.required.includes("followup_2"), "RG2: judgment editor also requires the controlled components the canonical carries (watch_out + one follow-up, positionally)");
const tSchema: any = buildEditorSchema(timingCanonical as any, "en");
ok(tSchema.required.includes("pace_band") && tSchema.required.includes("explanation"), "timing editor requires the pace_band control echo + explanation");
ok(!tSchema.required.includes("watch_out") && !tSchema.required.includes("practical_step") && !tSchema.required.includes("followup_1"), "RG2: timing editor requires NO controlled components (its canonical carries none)");
eq(editorSchemaName("thing_or_situation"), "lumis_dice_editor_level1_v2", "level1 editor schema name");

/* ---- structured, source-bound editor input: bound facts (M02) + source prose, both judgment axes ---- */
const jInput = buildEditorInput(judgmentCanonical as any, "我個application會唔會批？", judgmentLanding);
eq(jInput.facts.planet_orientation, "difficult", "judgment input binds the planet-side orientation as an internal fact");
eq(jInput.facts.house_orientation, "favourable", "judgment input binds the house-side orientation as an internal fact");
ok(jInput.source.planet_factor && jInput.source.house_factor && jInput.source.synthesis, "judgment source carries both factors + synthesis separately");
const tInput = buildEditorInput(timingCanonical as any, "幾時批？", timingLanding);
eq(tInput.facts.pace_band, paceFor(timingLanding), "timing input carries the AUTHORITATIVE resolver pace band as an internal fact");
const lInput = buildEditorInput(locationCanonical as any, "where is it?", locationLanding);
eq(lInput.facts.candidates, ["the bedroom", "the kitchen"], "location input carries the ordered candidate places as facts");

/* ---- C02: exact keys + identity validated BEFORE the status branch ---- */
const legalUnpresentable = (language: "en" | "zh-Hant", mode: DiceV05Mode) => JSON.stringify({
  status: "unpresentable", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language, question_mode: mode,
  headline: null, reading: null, watch_out: null, practical_step: null, suggested_followups: [],
});
eq(parseCustomerCopy("person", "en", legalUnpresentable("en", "person")).kind, "unpresentable", "C02: legal unpresentable object accepted");
// A bare {status:"unpresentable"} can no longer bypass key/identity validation.
eq(parseCustomerCopy("person", "en", JSON.stringify({ status: "unpresentable" })).kind, "invalid", "C02: bare unpresentable (missing keys) rejected, not accepted");
// unpresentable with non-null prose / non-empty followups is rejected.
eq(parseCustomerCopy("person", "en", JSON.stringify({ status: "unpresentable", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "person", headline: "x.", reading: null, watch_out: null, practical_step: null, suggested_followups: [] })).kind, "invalid", "C02: unpresentable with non-null prose rejected");
eq(parseCustomerCopy("person", "en", JSON.stringify({ status: "unpresentable", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "person", headline: null, reading: null, watch_out: null, practical_step: null, suggested_followups: ["q?"] })).kind, "invalid", "C02: unpresentable with nonempty followups rejected");
// wrong language/mode/schema and extra keys are all invalid regardless of status.
eq(parseCustomerCopy("person", "en", legalUnpresentable("zh-Hant", "person")).kind, "invalid", "C02: wrong language rejected even for unpresentable");
eq(parseCustomerCopy("person", "en", legalUnpresentable("en", "judgment")).kind, "invalid", "C02: wrong mode rejected even for unpresentable");

/* ---- prohibited-language + complete-ending heuristic catch the Founder-reported leaks ---- */
const badRank = copyOk({ language: "zh-Hant", question_mode: "judgment", headline: "大吉，排名第一。", reading: "第三順位又唔係好清楚。", watch_out: "留意。", suggested_followups: ["問題？"] });
ok(prohibitedLanguageCheck(badRank) !== "OK", "prohibited: rank/排名/順位/大吉 rejected");
const badFormula = copyOk({ language: "en", question_mode: "timing", headline: "It is medium.", reading: "This is planet_speed x house_speed = fastest x fast -> fast overall." });
ok(prohibitedLanguageCheck(badFormula) !== "OK", "prohibited: speed formula rejected");
const fragment = copyOk({ language: "en", question_mode: "person", headline: "This person is steady.", reading: "They tend to be careful and" });
ok(completenessCheck(fragment) !== "OK", "completeness: dangling 'and' rejected");
// C01: the known fragment is rejected WITH or WITHOUT a trailing period (normalizing punctuation must not bypass it).
ok(completenessCheck({ ...fragment, reading: "Beware of overex" }) !== "OK", "completeness: 'Beware of overex' rejected");
ok(completenessCheck({ ...fragment, reading: "Beware of overex." }) !== "OK", "C01: 'Beware of overex.' (period added) still rejected");
const cleanPerson = copyOk({ language: "en", question_mode: "person", headline: "This person is steady and practical.", reading: "They build trust slowly and prefer clear, concrete information.", practical_step: "Give them time to settle in." });
eq(prohibitedLanguageCheck(cleanPerson), "OK", "clean copy passes prohibited check");
eq(completenessCheck(cleanPerson), "OK", "clean copy passes completeness");

/* ---- C06: source parity (caution/practical presence, follow-up count) ---- */
// judgment: dropping the supplied caution is rejected; inventing follow-ups changes the count.
ok(sourceParityCheck({ ...deterministicCustomerCopy(judgmentCanonical as any), watch_out: null }, judgmentCanonical as any) === "DICE_COPY_CAUTION_DROPPED", "C06: dropped caution rejected");
ok(sourceParityCheck({ ...deterministicCustomerCopy(judgmentCanonical as any), suggested_followups: ["a?", "b?"] }, judgmentCanonical as any) === "DICE_COPY_FOLLOWUPS_COUNT_DRIFT", "C06: follow-up count drift rejected");
// S02: an equal-count REPLACEMENT/REORDER of follow-ups is rejected (not just a count change).
ok(sourceParityCheck({ ...deterministicCustomerCopy(judgmentCanonical as any), suggested_followups: ["完全不同的問題？"] }, judgmentCanonical as any) === "DICE_COPY_FOLLOWUPS_ORDER_OR_TEXT", "S02: equal-count follow-up replacement rejected");
// F07/S02: a TWO-follow-up REORDER (same items, swapped order) is rejected — a single-item case cannot
// demonstrate reordering, so this uses a two-item canonical and only permutes the order.
const twoFollowupJudgment = Object.freeze({ ...(judgmentCanonical as any), suggested_followups: ["我可以點樣改善溝通？", "我應該幾時提出？"] });
const twoFollowupBase = deterministicCustomerCopy(twoFollowupJudgment as any);
eq(sourceParityCheck(twoFollowupBase, twoFollowupJudgment as any), "OK", "F07 control: the in-order two-follow-up copy passes parity");
ok(sourceParityCheck({ ...twoFollowupBase, suggested_followups: [twoFollowupBase.suggested_followups[1], twoFollowupBase.suggested_followups[0]] }, twoFollowupJudgment as any) === "DICE_COPY_FOLLOWUPS_ORDER_OR_TEXT", "F07/S02: a two-follow-up REORDER (same items, swapped) is rejected");
// timing: inventing a caution the source did not supply is rejected.
ok(sourceParityCheck({ ...deterministicCustomerCopy(timingCanonical as any), watch_out: "Invented." }, timingCanonical as any) === "DICE_COPY_CAUTION_INVENTED", "C06: invented caution rejected");
// person (level-1): dropping the supplied practical step is rejected.
ok(sourceParityCheck({ ...deterministicCustomerCopy(personCanonical as any), practical_step: null }, personCanonical as any) === "DICE_COPY_PRACTICAL_DROPPED", "C06: dropped level-1 practical step rejected");

/* ---- deterministic fallback passes the SHARED display validation for every mode ---- */
for (const [n, c] of [["judgment", judgmentCanonical], ["timing", timingCanonical], ["location", locationCanonical], ["person", personCanonical]] as const) {
  const fb = deterministicCustomerCopy(c as any);
  eq(validateDisplayCopy(fb, c as any), "OK", `fallback ${n} passes the shared display validation`);
  eq(sourceParityCheck(fb, c as any), "OK", `fallback ${n} preserves caution/practical/follow-up parity`);
}
// C06: the judgment fallback keeps BOTH factors (planet + house prose) and stays within the reading cap.
const jFb = deterministicCustomerCopy(judgmentCanonical as any);
ok(jFb.reading.includes("火星") && jFb.reading.includes("外在條件"), "judgment fallback keeps both distinct factors");

/* ---- C01: a Judgment fallback whose combined reading exceeds the cap becomes unavailable, never sliced ---- */
const oversizeJudgment = { ...judgmentCanonical, planet_side: { ...(judgmentCanonical as any).planet_side, prose: "火".repeat(200) + "。" }, house_side: { ...(judgmentCanonical as any).house_side, prose: "外".repeat(200) + "。" } };
const oversizeFb = buildValidatedFallback(oversizeJudgment as any);
ok(!oversizeFb.ok, "C01: an over-cap judgment fallback is rejected (not sliced to fit)");

/* ---- execution (ALL-MODE editor path): the provider's edited answer + explanation are DISPLAYED for
 *      every mode; the controlled fields (watch / step / follow-ups) are ALSO language-improved (RG2)
 *      under the source-relative guards, so the EDITED wording displays (not a canonical pass-through). ---- */
const copyAdapter = (content: string, kind: DiceV05ProviderResult["kind"] = "success"): DiceV05ProviderAdapter => ({
  invoke: async () => (kind === "success" ? { kind: "success", content } : { kind } as DiceV05ProviderResult),
});
// A valid judgment EDITOR response: separate factor components + synthesis, PLUS the RG2 controlled
// components (a reworded caution + a reworded follow-up). The planet factor is bound to the canonical
// planet orientation ("difficult") and the house factor to the house orientation ("favourable"); its
// assembled answer + reading ARE displayed (source stage3), and the EDITED caution/follow-up display too.
const goodJudgmentEditor = editorOk("zh-Hant", "judgment", {
  answer: "外在條件較有利，但你的處理方式是關鍵。",
  planet_factor: "你這面比較吃力，若處理得太急或太強硬，容易遇到阻力。",
  house_factor: "周圍環境對你有利，對方有合作空間。",
  synthesis: "兩邊要分開理解：環境有幫助，但你的處理方式會明顯影響結果。",
  watch_out: "跟進時記得留意語氣，避免給對方壓力。",
  followup_1: "我可以點樣令溝通更順暢？",
});
const r1 = await executeDiceV05CustomerCopy(judgmentCanonical as any, "我個application會唔會批？", copyAdapter(goodJudgmentEditor), { now: () => 1000, landing: judgmentLanding });
eq(r1.source, "stage3", "valid judgment editor response → edited prose IS displayed (all-mode editor)");
eq(r1.provider_calls, 1, "one Stage-3 provider call");
ok(r1.editor_response !== null, "stage3 outcome carries the structured editor_response for the wire (V02)");
ok(r1.copy && r1.copy.practical_step === null, "judgment copy keeps practical_step null (canonical carries none)");
ok(r1.copy && r1.copy.reading.includes("對方有合作空間") && r1.copy.reading.includes("阻力"), "judgment display keeps BOTH edited factors, each bound to its orientation");
// RG2: the caution + follow-up are now the EDITED wording, and they differ from the raw canonical text.
ok(r1.copy && r1.copy.watch_out === ensureTerminalLike("跟進時記得留意語氣，避免給對方壓力。"), "RG2: judgment watch_out is the EDITED caution");
ok(r1.copy && r1.copy.watch_out !== ensureTerminalLike((judgmentCanonical as any).watch_out), "RG2: the edited caution is NOT the raw canonical wording");
ok(r1.copy && r1.copy.suggested_followups.length === 1 && r1.copy.suggested_followups[0] === ensureTerminalLike("我可以點樣令溝通更順暢？"), "RG2: judgment follow-up is the EDITED question, count preserved");
// A valid Level-1 editor response: answer + explanation PLUS the RG2 controlled components (a reworded
// caution + practical step). The EDITED controlled fields display (person canonical carries no follow-ups).
const goodPersonEditor = editorOk("en", "person", {
  answer: "They are steady and reliable.",
  explanation: "They earn trust slowly through consistent, dependable actions.",
  watch_out: "Keep in mind they may stay reserved until they feel settled.",
  practical_step: "Try giving them clear, concrete detail rather than pressure.",
});
const rL = await executeDiceV05CustomerCopy(personCanonical as any, "what kind of person?", copyAdapter(goodPersonEditor), { now: () => 1000, landing: personLanding });
eq(rL.source, "stage3", "valid Level-1 editor prose is used");
ok(rL.copy && rL.copy.reading.includes("consistent"), "Level-1 display uses editor explanation");
ok(rL.copy && rL.copy.watch_out === ensureTerminalLike("Keep in mind they may stay reserved until they feel settled."), "RG2: Level-1 watch_out is the EDITED caution");
ok(rL.copy && rL.copy.practical_step === ensureTerminalLike("Try giving them clear, concrete detail rather than pressure."), "RG2: Level-1 practical_step is the EDITED step");
ok(rL.copy && rL.copy.watch_out !== ensureTerminalLike((personCanonical as any).watch_out) && rL.copy.practical_step !== ensureTerminalLike((personCanonical as any).practical_step), "RG2: the edited Level-1 controlled fields are NOT the raw canonical wording");

/* ---- execution: a judgment editor response whose ASSEMBLED prose leaks rank/大吉 → rejected → fallback ---- */
const rankyEditor = editorOk("zh-Hant", "judgment", {
  answer: "大吉，排名第一。",
  planet_factor: "你這面比較吃力，會遇到阻力。",
  house_factor: "環境有利。",
  synthesis: "第三順位。",
  watch_out: "跟進時留意語氣，避免催逼。",
  followup_1: "我可以點樣改善溝通？",
});
const r2 = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", copyAdapter(rankyEditor), { now: () => 1000, landing: judgmentLanding });
eq(r2.source, "fallback", "a judgment editor response leaking rank/大吉 is rejected → deterministic fallback");
ok(r2.copy && prohibitedLanguageCheck(r2.copy) === "OK", "the displayed judgment fallback is clean (canonical, not the prohibited editor prose)");

/* ---- execution: a Level-1 editor response whose PROSE is prohibited → fallback ---- */
const rankyPersonEditor = editorOk("en", "person", { answer: "They rank first.", explanation: "This sits on rank 7 of the houses.", watch_out: "Keep in mind they may stay reserved at first.", practical_step: "Try giving them clear, concrete detail rather than pressure." });
const rLbad = await executeDiceV05CustomerCopy(personCanonical as any, "q", copyAdapter(rankyPersonEditor), { now: () => 1000, landing: personLanding });
eq(rLbad.source, "fallback", "Level-1 editor response with prohibited prose falls back deterministically");
ok(rLbad.copy && prohibitedLanguageCheck(rLbad.copy) === "OK", "the Level-1 fallback is clean");

/* ---- execution: provider network error → fallback; legal unpresentable → fallback/unavailable ---- */
const r3 = await executeDiceV05CustomerCopy(timingCanonical as any, "幾時批？", copyAdapter("", "network"), { now: () => 1000, landing: timingLanding });
eq(r3.source, "fallback", "provider failure falls back");
// RG2: an unpresentable editor response must null EVERY component the canonical requires, including the
// controlled ones (person carries a caution + practical step), or it is a key mismatch, not a legal unpresentable.
const r4 = await executeDiceV05CustomerCopy(personCanonical as any, "what kind of person?", copyAdapter(editorUnpresentable("en", "person", ["answer", "explanation", "watch_out", "practical_step"])), { now: () => 1000, landing: personLanding });
ok(r4.source === "fallback" || r4.source === "unavailable", "explicit unpresentable routes to fallback/unavailable, never a reading");
eq(r4.failure_code?.startsWith("DICE_COPY_UNPRESENTABLE"), true, "unpresentable code recorded");

/* ---- C03: one absolute deadline — exhausted budget makes ZERO Stage-3 calls ---- */
let called = 0;
const countingAdapter: DiceV05ProviderAdapter = { invoke: async () => { called += 1; return { kind: "success", content: goodJudgmentEditor }; } };
const past = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", countingAdapter, { now: () => 5000, deadlineAtMs: 4000, landing: judgmentLanding });
eq(called, 0, "C03: no time left → zero Stage-3 provider calls");
ok(past.source === "fallback" || past.source === "unavailable", "C03: exhausted budget yields fallback/unavailable");
eq(past.provider_calls, 0, "C03: provider_calls is 0 when the budget is already spent");
// A retry runs against the SAME absolute deadline (it does not reset it): a failing adapter that
// keeps time within budget is allowed exactly two attempts, no more.
let attempts = 0;
const twoThenStop: DiceV05ProviderAdapter = { invoke: async () => { attempts += 1; return { kind: "network" } as DiceV05ProviderResult; } };
let clock = 1000;
const retry = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", twoThenStop, { now: () => clock, deadlineAtMs: 12000 });
eq(attempts, 2, "C03: one controlled retry → exactly two attempts within the shared deadline");
eq(retry.provider_calls, 2, "C03: two provider calls recorded for the retry path");

/* ---- G04-B: Stage-3 counts only real TRANSPORT requests, on the first attempt AND the retry. ---- */
// Both attempts short-circuit before any network call (transported:false) → zero provider calls.
let g04Attempts = 0;
const noTransport: DiceV05ProviderAdapter = { invoke: async () => { g04Attempts += 1; return { kind: "timeout", transported: false } as DiceV05ProviderResult; } };
const g04NoTransport = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", noTransport, { now: () => 1000, deadlineAtMs: 20000 });
eq(g04Attempts, 2, "G04-B: both Stage-3 attempts were made (budget available)");
eq(g04NoTransport.provider_calls, 0, "G04-B: a non-transported attempt is NOT counted, on either attempt");
// One real transport (network failure) then a non-transported retry → exactly one provider call.
let g04Seq = 0;
const oneThenNone: DiceV05ProviderAdapter = { invoke: async () => { g04Seq += 1; return (g04Seq === 1 ? { kind: "network" } : { kind: "timeout", transported: false }) as DiceV05ProviderResult; } };
const g04Mixed = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", oneThenNone, { now: () => 1000, deadlineAtMs: 20000 });
eq(g04Mixed.provider_calls, 1, "G04-B: one real transport + one non-transported retry → exactly one provider call");
// A genuine transported failure on both attempts IS counted twice (contrast control).
let g04Real = 0;
const realFail: DiceV05ProviderAdapter = { invoke: async () => { g04Real += 1; return { kind: "network" } as DiceV05ProviderResult; } };
const g04RealRes = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", realFail, { now: () => 1000, deadlineAtMs: 20000 });
eq(g04RealRes.provider_calls, 2, "G04-B: two genuine transported failures are counted as two provider calls");

/* ---- D02: the RAW provider output is measured before parse/normalization (real tokenizer) ---- */
// A valid person editor response padded with whitespace so the RAW string exceeds the 700-token cap
// while the NORMALIZED object stays well within it. The raw guard must reject it (→ fallback),
// proving whitespace/escape padding cannot slip a huge raw response past measurement.
const paddedRaw = editorOk("en", "person", { answer: "They are steady.", explanation: "They build trust slowly.", watch_out: "Keep in mind they may stay reserved at first.", practical_step: "Try giving them clear, concrete detail rather than pressure." }) + " \n".repeat(1500);
ok(!measureDiceTokenLimit(paddedRaw, CUSTOMER_COPY_OUTPUT_CAP).within_limit, "D02: the padded RAW string exceeds the 700-token cap");
const rawRes = await executeDiceV05CustomerCopy(personCanonical as any, "q", copyAdapter(paddedRaw), { now: () => 1000, landing: personLanding });
eq(rawRes.source, "fallback", "D02: an over-cap RAW response is rejected before parse → deterministic fallback");
ok(rawRes.failure_code === "DICE_COPY_RAW_OUTPUT_TOKEN_CAP", "D02: raw-output cap failure code recorded");

/* ---- V06/S06: a dangling fragment MID-paragraph inside an edited component is rejected, not
 *      laundered by a clean final sentence (sentence-level segment check before composition). ---- */
const fragRes = await executeDiceV05CustomerCopy(personCanonical as any, "q", copyAdapter(editorOk("en", "person", { answer: "They are steady.", explanation: "They tend to be careful and. They value clear commitments.", watch_out: "Keep in mind they may stay reserved at first.", practical_step: "Try giving them clear, concrete detail rather than pressure." })), { now: () => 1000, landing: personLanding });
eq(fragRes.source, "fallback", "V06: a mid-paragraph 'careful and.' fragment in the edited explanation is rejected → fallback");
ok(fragRes.copy && completenessCheck(fragRes.copy) === "OK", "V06: the resulting fallback is itself complete");

/* ---- F03: each Judgment source-prose COMPONENT is validated before the components are joined.
 *      A broken Planet, House or synthesis component makes the deterministic assembly UNAVAILABLE
 *      (a valid final synthesis never conceals an earlier fragment), with and without a terminal
 *      period, in EN and zh-Hant. ---- */
const enJudgment = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "judgment",
  planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護（最強）", strength: "strong",
    constructive_traits: "Generous, trustworthy and wise", difficult_traits: "Wasteful, reckless and careless", dignity_emphasis: "constructive",
    prose: "Jupiter is a major benefic at full strength here." },
  house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: "House 1 is the most supportive setting, with the matter in your hands." },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "Both fixed sides are favourable and remain separate.", timing_summary: null,
  watch_out: "Keep optimism realistic even with strong support.", practical_step: null, suggested_followups: ["What most needs preparing first?"] };
eq(validateDiceV05FinalResult(enJudgment as any), "OK", "F03 control: the EN Judgment canonical is a valid final result");
eq(canonicalProseComplete(enJudgment as any), "OK", "F03 control: a fully complete Judgment canonical passes component validation");
for (const [label, broken] of [
  ["P12 planet prose 'and' (period)", { ...enJudgment, planet_side: { ...enJudgment.planet_side, prose: "They tend to be careful and." } }],
  ["P12 planet prose 'and' (no period)", { ...enJudgment, planet_side: { ...enJudgment.planet_side, prose: "They tend to be careful and" } }],
  ["P13 house prose 'overex' (period)", { ...enJudgment, house_side: { ...enJudgment.house_side, prose: "Beware of overex." } }],
  ["P13 house prose 'overex' (no period)", { ...enJudgment, house_side: { ...enJudgment.house_side, prose: "Beware of overex" } }],
  ["synthesis 'because'", { ...enJudgment, synthesis: "A strong benefic sits inside the house because" }],
  ["zh planet prose connector '因為'", { ...judgmentCanonical, planet_side: { ...(judgmentCanonical as any).planet_side, prose: "火星這一面較為困難，因為" } }],
  ["zh synthesis connector '所以'", { ...judgmentCanonical, synthesis: "外在環境有利，所以" }],
] as const) {
  ok(canonicalProseComplete(broken as any) !== "OK", `F03: broken component caught before join — ${label}`);
  ok(!buildValidatedFallback(broken as any).ok, `F03: buildValidatedFallback → unavailable for ${label}`);
}
// A valid final synthesis must NOT conceal an earlier broken Planet prose (the exact S06 regression).
const hiddenFragment = { ...enJudgment, planet_side: { ...enJudgment.planet_side, prose: "They tend to be careful and" } };
ok(!buildValidatedFallback(hiddenFragment as any).ok, "F03: a valid synthesis does not conceal an earlier Planet-prose fragment");

/* ---- F04: the Chinese dangling-tail heuristic no longer rejects ordinary sentences that merely END
 *      in a character that can also be a connector (同/和). Positive controls MUST pass; genuine
 *      unfinished multi-character connector clauses MUST still fail. ---- */
for (const good of ["每個人的需要不同。", "溝通時保持溫和。", "這個決定需要耐心。", "佢哋通常都好謹慎同務實。"]) {
  eq(completenessCheck(copyOk({ language: "zh-Hant", question_mode: "person", headline: "一個穩陣務實嘅人。", reading: good })), "OK", `F04 positive control passes: ${good}`);
}
// English: a sentence legitimately ending after a complete clause is not a fragment.
eq(completenessCheck(copyOk({ language: "en", question_mode: "person", headline: "A steady person.", reading: "That is what the symbols point to." })), "OK", "F04: ordinary English sentence passes");
// Genuine unfinished connector clauses still fail (EN 'because'; zh multi-char connectors).
ok(completenessCheck(copyOk({ language: "en", question_mode: "person", headline: "A steady person.", reading: "They are careful because" })) !== "OK", "F04: genuine EN connector clause still rejected");
ok(completenessCheck(copyOk({ language: "zh-Hant", question_mode: "person", headline: "一個人。", reading: "佢哋好謹慎，因為" })) !== "OK", "F04: genuine zh '因為' connector clause still rejected");
ok(completenessCheck(copyOk({ language: "zh-Hant", question_mode: "person", headline: "一個人。", reading: "佢哋好謹慎，不過" })) !== "OK", "F04: genuine zh '不過' connector clause still rejected");

/* ---- production-tokenizer max-sample envelope measurement (report + assert within cap) ---- */
const maxEnvelope = (mode: DiceV05Mode, language: "en" | "zh-Hant") => {
  const c = COPY_CAPS; const fam = mode === "judgment" || mode === "timing" || mode === "location" ? mode : "level1";
  const fill = (n: number) => (language === "en" ? "a" : "字").repeat(n);
  const body: any = { status: "ok", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language, question_mode: mode,
    headline: fill(c.headline[language]), reading: fill(c.reading[language]),
    watch_out: fill(c.watch_out[language]),
    practical_step: fam === "judgment" || fam === "timing" ? null : fill(c.practical_step[language]),
    suggested_followups: fam === "judgment" ? [fill(c.followup[language]), fill(c.followup[language]), fill(c.followup[language])] : [] };
  return JSON.stringify(body);
};
for (const mode of ["judgment", "timing", "location", "person"] as DiceV05Mode[]) {
  for (const language of ["en", "zh-Hant"] as const) {
    const env = maxEnvelope(mode, language);
    const m = measureDiceTokenLimit(env, CUSTOMER_COPY_OUTPUT_CAP);
    console.log(`copy-envelope ${mode}/${language}: tokens=${m.token_count} cap=${CUSTOMER_COPY_OUTPUT_CAP} within=${m.within_limit} (max among filled samples, not a mathematical worst case)`);
    ok(m.within_limit, `max-sample ${mode}/${language} customer-copy envelope fits ${CUSTOMER_COPY_OUTPUT_CAP} tokens`);
  }
}

// The fixed unavailable message is stable and non-interpretive.
ok(CUSTOMER_COPY_UNAVAILABLE_MESSAGE.en.length > 0 && CUSTOMER_COPY_UNAVAILABLE_MESSAGE["zh-Hant"].length > 0, "unavailable message defined for both languages");

/* ---- V05/V04: backstop meaning-contradiction guard on the assembled copy (the primary per-factor
 *      binding is exercised below via assembleEditorCopy). ---- */
// Judgment: on a MIXED canonical a totalizing one-sided claim is rejected either way; a faithful
// mixed rewrite (INCLUDING a correct negation) passes. planet favourable (constructive) + house difficult.
const mixedJudg = { ...(enJudgment as any), house_side: { fortune: "great_misfortune", fortune_zh: "大凶", rank: 12, prose: "House 12 is a hidden, difficult setting here." }, synthesis: "The planet side is favourable while the house environment is difficult." };
ok(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Everything is favourable.", reading: "Both factors support you with no obstacles at all.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any) !== "OK", "V05: an all-positive reading on a mixed canonical is rejected (dropped-difficult)");
ok(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Both factors oppose this.", reading: "Everything here is against you and unfavourable.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any) !== "OK", "V05: an all-negative reading on a mixed canonical is rejected (dropped-favourable)");
eq(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Your strengths are real, but the setting is hard.", reading: "You have genuine capacity working for you, yet the surroundings make it difficult; the two stay separate.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any), "OK", "V05: a faithful mixed rewrite passes the backstop");
// V05 (fixes R04): a CORRECT NEGATION of a totalizer is NOT a false all-positive claim.
eq(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Support is real, but not everything is favourable.", reading: "Not every factor is favourable here: your side helps, yet the setting works against you.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any), "OK", "V05: 'Not every factor is favourable' (correct negation) is NOT falsely rejected");
// Timing backstop uses the AUTHORITATIVE resolver pace via the landing (V04). Non-fast landing:
ok(!["fastest", "fast"].includes(paceFor(timingLanding)), "V04 control: the timing landing resolves to a NON-fast band");
ok(meaningContradictionCheck(copyOk({ language: "en", question_mode: "timing", headline: "It resolves immediately.", reading: "This happens right away." }), timingCanonical as any, timingLanding) !== "OK", "V04: an immediacy claim contradicting a non-fast landing is rejected");
eq(meaningContradictionCheck(copyOk({ language: "en", question_mode: "timing", headline: "A moderate wait is likely.", reading: "This will not resolve immediately; it develops over time." }), timingCanonical as any, timingLanding), "OK", "V04: a negated-immediacy moderate rewrite passes");

/* ---- PRIMARY structured source-binding in assembleEditorCopy (V03/V04/V05/V06), both languages. ---- */
const asm = (canonical: any, language: "en" | "zh-Hant", mode: DiceV05Mode, components: Record<string, string>, landing?: Landing) => {
  const p = parseEditorResponse(canonical, language, editorOk(language, mode, withControlled(canonical, components)));
  if (p.kind !== "ok") return { ok: false as const, reason: `PARSE_${p.kind === "invalid" ? p.code : "UNPRESENTABLE"}` };
  return assembleEditorCopy(canonical, p.value, landing);
};
// V05 judgment (EN, mixed: planet favourable, house difficult).
const jFaithful = asm(mixedJudg, "en", "judgment", { answer: "Your side helps, but the setting is hard.", planet_factor: "Your own capacity is a genuine strength working in your favour.", house_factor: "The surrounding setting is difficult and adds friction.", synthesis: "Real support on one side, real difficulty on the other; the two stay separate." }, judgmentLanding);
ok(jFaithful.ok, "V05 EN: a faithful two-factor rewrite assembles");
ok(jFaithful.ok && validateDisplayCopy(jFaithful.copy, mixedJudg as any, judgmentLanding, true) === "OK", "V05 EN: the faithful assembled judgment copy passes display validation");
// Swap: planet factor carries the DIFFICULT signal (opposite of its favourable orientation).
eq(asm(mixedJudg, "en", "judgment", { answer: "x.", planet_factor: "Your own side is difficult and works against you with real friction.", house_factor: "The setting strongly supports you and helps throughout.", synthesis: "They stay separate." }, judgmentLanding), { ok: false, reason: "DICE_COPY_JUDGMENT_PLANET_FACTOR_ORIENTATION" }, "V05 EN: a swapped planet factor (favourable→difficult) is rejected");
// Omission/averaged: the difficult house factor is written favourable-only.
eq(asm(mixedJudg, "en", "judgment", { answer: "x.", planet_factor: "Your side is a real strength that helps you.", house_factor: "The setting also supports you and helps, with everything in your favour.", synthesis: "They stay separate." }, judgmentLanding), { ok: false, reason: "DICE_COPY_JUDGMENT_HOUSE_FACTOR_ORIENTATION" }, "V05 EN: a dropped/averaged difficult factor (written favourable) is rejected");
// V05 judgment (zh-Hant, mixed: planet difficult, house favourable — from judgmentCanonical).
const jZhFaithful = asm(judgmentCanonical, "zh-Hant", "judgment", { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。" }, judgmentLanding);
ok(jZhFaithful.ok, "V05 zh: a faithful two-factor rewrite assembles");
eq(asm(judgmentCanonical, "zh-Hant", "judgment", { answer: "x。", planet_factor: "你這面好有利，有明顯助力，順暢。", house_factor: "周圍環境不利，充滿阻力同困難。", synthesis: "兩邊分開理解。" }, judgmentLanding).ok, false, "V05 zh: a swapped factor pair is rejected");
// V04 timing: correct pace echo assembles; a wrong echo and an immediacy claim are rejected.
const paceBand = paceFor(timingLanding);
ok(asm(timingCanonical, "zh-Hant", "timing", { answer: "預計需要中等時間。", pace_band: paceBand, explanation: "事情本身較慢，但環境會推動，整體屬中等，會逐步發展。" }, timingLanding).ok, "V04: a correct pace-band echo assembles");
eq(asm(timingCanonical, "zh-Hant", "timing", { answer: "預計需要中等時間。", pace_band: "fast", explanation: "整體中等，會逐步發展。" }, timingLanding), { ok: false, reason: "DICE_COPY_TIMING_PACE_ECHO" }, "V04: a wrong pace-band echo is rejected");
eq(asm(timingCanonical, "en", "timing", { answer: "It happens right away.", pace_band: paceBand, explanation: "This resolves immediately with no delay." }, timingLanding), { ok: false, reason: "DICE_COPY_TIMING_PACE_CONTRADICTED" }, "V04: an immediacy claim on a non-fast band is rejected");
// V03 location: clean clues assemble; a movement instruction is rejected (EN + zh).
ok(asm(locationCanonical, "en", "location", { clues: "The strongest sign points to a private, indoor spot at home, near where daily items are kept." }, locationLanding).ok, "V03: clean Location clue prose assembles");
eq(asm(locationCanonical, "en", "location", { clues: "Go to the airport first, then look at home." }, locationLanding), { ok: false, reason: "DICE_COPY_LOCATION_IMPERATIVE" }, "V03 EN: a movement instruction in the clue prose is rejected");
eq(asm(locationCanonical, "en", "location", { clues: "前往機場先，再返屋企搵。" }, locationLanding).ok, false, "V03 zh: a movement instruction in the clue prose is rejected");
// V06: a mid-paragraph fragment in a component is rejected before composition.
eq(asm(personCanonical, "en", "person", { answer: "A careful person.", explanation: "They tend to be careful and. They value clarity." }, personLanding).ok, false, "V06: a mid-paragraph fragment in the edited explanation is rejected");

/* ---- VM-2 negative controls: identifiers/orientation CORRECT but the wording reverses meaning or
 *      introduces an unsupported place. Binding a factor to an orientation is NOT satisfied by echoing
 *      an orientation word — a strong directional phrase in the opposite direction is still caught. ---- */
// Judgment (mixedJudg: planet favourable) — the planet factor carries a favourable word ("strength")
// yet asserts the OPPOSITE direction ("works against you"): rejected despite the correct orientation word.
eq(asm(mixedJudg, "en", "judgment", { answer: "x.", planet_factor: "Your own strength here actually works against you at every turn.", house_factor: "The setting is difficult and adds friction.", synthesis: "The two stay separate." }, judgmentLanding), { ok: false, reason: "DICE_COPY_JUDGMENT_PLANET_FACTOR_ORIENTATION" }, "VM-2: a favourable factor whose wording reverses direction (strong opposition) is rejected, not accepted on the orientation word alone");
// zh-Hant equivalent (judgmentCanonical: house favourable) — house factor uses a favourable word but a
// strong opposite phrase.
eq(asm(judgmentCanonical, "zh-Hant", "judgment", { answer: "x。", planet_factor: "你這面比較吃力，遇到阻力。", house_factor: "周圍環境雖然有支持，但其實對你不利，拖你後腿。", synthesis: "兩邊分開理解。" }, judgmentLanding).ok, false, "VM-2 zh: a favourable house factor whose wording reverses direction is rejected");
// Location — the clue prose introduces an UNSUPPORTED place (no movement verb), not among the approved
// candidates/area: rejected.
eq(asm(locationCanonical, "en", "location", { clues: "The strongest clue points to a locker inside the airport lounge." }, locationLanding), { ok: false, reason: "DICE_COPY_LOCATION_UNSUPPORTED_PLACE" }, "VM-2: an unsupported place ('airport') in the Location clue prose is rejected");
// A clue that stays within the approved area (home) and adds no new place still passes.
ok(asm(locationCanonical, "en", "location", { clues: "The strongest sign points to a private, indoor spot at home, out of plain view." }, locationLanding).ok, "VM-2 control: a clue that introduces no new place passes");
// Person (Level-1) — a DIRECTLY REVERSED description. Level-1 modes have no orientation/pace to bind,
// so the structural guards do NOT catch this reversal: it currently ASSEMBLES. Explicit REGRESSION
// marker for an OPEN requirement gap (RG1) — NOT dismissed as future live QA. If a Level-1 fidelity
// guard is later added, this expectation must flip to ok:false. See 06-later-testing.md (RG1).
{
  const reversed = asm(personCanonical, "en", "person", { answer: "A reckless, erratic person.", explanation: "This points to someone impulsive and unreliable who avoids any clear commitment." }, personLanding);
  eq(reversed.ok, true, "VM-2 KNOWN GAP (regression marker): a directly reversed Person description is NOT caught structurally — Level-1 semantic fidelity is an OPEN requirement gap (RG1), tracked, not dismissed as live QA");
}

/* ---- RG2: the editor also LANGUAGE-IMPROVES the controlled fields (caution, practical/search step,
 *      follow-ups), preserving meaning + ORDER. A reworded caution / step / follow-up is ACCEPTED and
 *      the EDITED text is what displays; an inverted or de-warned caution, a non-question follow-up, a
 *      dropped search action / candidate place, an unsupported place / movement step, and a dropped or
 *      extra follow-up are REJECTED. Order/count are structural (positional followup_1..N keys). The
 *      guards are documented heuristics, NOT a fidelity proof — full paraphrase fidelity stays open
 *      (RG2/RG3), the same disclosed limit as the answer/explanation editor. ---- */
// Positive (EN judgment, mixedJudg carries a caution + one follow-up): a reworded caution and follow-up
// are accepted and the EDITED wording (not the canonical wording) is carried into the display copy.
{
  const edited = asm(mixedJudg, "en", "judgment",
    { answer: "Your side helps, but the setting is hard.", planet_factor: "Your own capacity is a genuine strength working in your favour.", house_factor: "The surrounding setting is difficult and adds friction.", synthesis: "Real support on one side, real difficulty on the other; the two stay separate.",
      watch_out: "Do keep your hopes realistic even with strong backing.", followup_1: "Which part is most worth preparing first?" },
    judgmentLanding);
  ok(edited.ok, "RG2 EN: a reworded caution + follow-up assemble alongside the edited answer/factors");
  ok(edited.ok && edited.copy.watch_out === ensureTerminalLike("Do keep your hopes realistic even with strong backing."), "RG2 EN: the EDITED caution (not the canonical wording) is what displays");
  ok(edited.ok && edited.copy.suggested_followups.length === 1 && edited.copy.suggested_followups[0] === ensureTerminalLike("Which part is most worth preparing first?"), "RG2 EN: the EDITED follow-up displays, count preserved");
  ok(edited.ok && validateDisplayCopy(edited.copy, mixedJudg as any, judgmentLanding, true) === "OK", "RG2 EN: the edited controlled fields pass display validation (coverage mode)");
  // The SAME edited copy fails validation WITHOUT the edited-path flag: the deterministic pass-through
  // parity is unchanged and still rejects a rewrite, so the relaxation is scoped to the accepted editor.
  ok(edited.ok && validateDisplayCopy(edited.copy, mixedJudg as any, judgmentLanding, false) !== "OK", "RG2 EN: the same edited copy is rejected under EXACT pass-through parity (deterministic path unchanged)");
}
// Positive (EN location, R02): per-candidate search phrases; the SERVER assembles them in canonical
// RANK order (bedroom then kitchen), so the editor improves phrasing but cannot reorder the sequence.
{
  const edited = asm(locationCanonical, "en", "location",
    { clues: "The strongest sign points to a private, indoor spot at home.", search_step_1: "Try looking in the bedroom", search_step_2: "check the kitchen" },
    locationLanding);
  ok(edited.ok, "R02 EN location: per-candidate reworded search phrases assemble");
  ok(edited.ok && edited.copy.practical_step === ensureTerminalLike("Try looking in the bedroom; then check the kitchen"), "R02 EN location: the server assembles the edited phrases in canonical rank order (bedroom first)");
  ok(edited.ok && validateDisplayCopy(edited.copy, locationCanonical as any, locationLanding, true) === "OK", "R02 EN location: the assembled step passes display validation");
}
// A01: a per-candidate phrase carrying its OWN sequencing word is rejected — order is server-owned, so
// "Search the bedroom last" cannot contradict the assembled canonical sequence.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Search the bedroom last", search_step_2: "search the kitchen first" }, locationLanding), { ok: false, reason: "DICE_COPY_STEP_SEQUENCING" }, "A01: a per-candidate search phrase with its own sequencing word ('last') is rejected");
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Before anything else, search the bedroom" }, locationLanding), { ok: false, reason: "DICE_COPY_STEP_SEQUENCING" }, "A01: a per-candidate phrase with 'Before' sequencing is rejected");
// A01: a clean per-candidate set (no sequencing words) assembles in server-owned canonical order.
{
  const edited = asm(locationCanonical, "en", "location",
    { clues: "A private indoor spot at home.", search_step_1: "have a good look in the bedroom", search_step_2: "check the kitchen" },
    locationLanding);
  ok(edited.ok, "A01: a clean per-candidate set (no sequencing words) is accepted");
  ok(edited.ok && edited.copy.practical_step!.toLowerCase().indexOf("bedroom") < edited.copy.practical_step!.toLowerCase().indexOf("kitchen"), "A01: the server assembles the rank-1 place first");
}
// Positive (zh-Hant judgment, judgmentCanonical carries a caution + one follow-up).
{
  const edited = asm(judgmentCanonical, "zh-Hant", "judgment",
    { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。",
      watch_out: "記住跟進時要留意語氣，避免催逼對方。", followup_1: "我可以點樣令溝通更順暢？" },
    judgmentLanding);
  ok(edited.ok, "RG2 zh: a reworded caution + follow-up assemble");
  ok(edited.ok && edited.copy.watch_out === ensureTerminalLike("記住跟進時要留意語氣，避免催逼對方。"), "RG2 zh: the EDITED caution displays");
  ok(edited.ok && validateDisplayCopy(edited.copy, judgmentCanonical as any, judgmentLanding, true) === "OK", "RG2 zh: the edited controlled fields pass display validation");
}
// C03 (review): a caution inverted into an all-clear now PASSES assembly — the inversion is a SEMANTIC
// judgement decided by the mandatory Stage-4 checker (→ 'changes' → fallback), not a lexical heuristic
// that also false-rejected faithful paraphrases. The composition/contract tests prove the checker catches it.
ok(asm(mixedJudg, "en", "judgment", { answer: "x.", planet_factor: "Your own capacity is a genuine strength in your favour.", house_factor: "The setting is difficult and adds friction.", synthesis: "They stay separate.", watch_out: "Nothing to worry about here; you can relax." }, judgmentLanding).ok, "C03: a caution inverted into an all-clear now passes ASSEMBLY (the inversion is caught by the checker, not a lexical heuristic)");
// C07 (review): a FAITHFUL caution paraphrase that omits a stock warning word ("Beware"/"watch") is
// NOT rejected — the guard is source-relative (no polarity reversal), not a mandatory-vocabulary rule.
ok(asm(mixedJudg, "en", "judgment", { answer: "x.", planet_factor: "Your own capacity is a genuine strength in your favour.", house_factor: "The setting is difficult and adds friction.", synthesis: "They stay separate.", watch_out: "Try to keep your hopes grounded even with strong support." }, judgmentLanding).ok, "C07: a faithful caution paraphrase without a stock warning word is accepted (no forced vocabulary)");
// Adversarial — a follow-up rewritten as a statement (no longer a question) is rejected.
eq(asm(mixedJudg, "en", "judgment", { answer: "x.", planet_factor: "Your own capacity is a genuine strength in your favour.", house_factor: "The setting is difficult and adds friction.", synthesis: "They stay separate.", followup_1: "You should prepare the documents first." }, judgmentLanding), { ok: false, reason: "DICE_COPY_FOLLOWUP_NOT_QUESTION" }, "RG2: a follow-up rewritten as a statement (not a question) is rejected");
// Adversarial (location, per-candidate) — slot-1 phrase that does not name the rank-1 place is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Try searching somewhere quiet" }, locationLanding), { ok: false, reason: "DICE_COPY_STEP_CANDIDATE_DROPPED" }, "R02 location: a slot-1 search phrase that omits the rank-1 place is rejected");
// Slot-1 phrase that NEGATES the rank-1 place ("do not search the bedroom") is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Do not search the bedroom" }, locationLanding), { ok: false, reason: "DICE_COPY_STEP_REVERSED" }, "R02/C04 location: a slot-1 phrase that negates its own place is rejected");
// Slot-1 phrase that names the rank-2 place (cross-reference / reorder attempt) is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Search the bedroom and the kitchen" }, locationLanding), { ok: false, reason: "DICE_COPY_STEP_ORDER" }, "R02 location: a slot-1 phrase that also names the rank-2 place is rejected (each phrase is its own place)");
// A non-actionable slot phrase is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "The bedroom is nearby" }, locationLanding), { ok: false, reason: "DICE_COPY_STEP_NOT_ACTIONABLE" }, "R02 location: a non-actionable slot phrase is rejected");
// A slot phrase that introduces an unsupported place is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Search the bedroom near the airport" }, locationLanding), { ok: false, reason: "DICE_COPY_LOCATION_UNSUPPORTED_PLACE" }, "R02 location: a slot phrase naming an unsupported place is rejected");
// A slot phrase turned into a movement instruction is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", search_step_1: "Go to the bedroom to search" }, locationLanding), { ok: false, reason: "DICE_COPY_LOCATION_IMPERATIVE" }, "R02 location: a slot phrase turned into a movement instruction is rejected");
// C03 (review): a practical step inverted into an all-clear now PASSES assembly — the semantic decision
// (inversion vs faithful paraphrase) is the checker's, not a lexical heuristic that false-rejected
// faithful negation paraphrases.
ok(asm(personCanonical, "en", "person", { answer: "A careful person.", explanation: "This points to someone steady and dependable.", practical_step: "Rest assured, there is nothing to worry about." }, personLanding).ok, "C03 person: a practical step inverted into an all-clear now passes ASSEMBLY (caught by the checker)");
// Structural (parse) — order/count of the controlled components is enforced by the positional keys:
// a MISSING required controlled component is rejected at parse...
eq(parseEditorResponse(locationCanonical as any, "en", editorOk("en", "location", { clues: "A private indoor spot at home.", watch_out: "Do not assume it is gone for good." })).kind, "invalid", "RG2/R02: a Location editor response missing the required per-candidate search_step components is rejected at parse");
// ...and an EXTRA follow-up beyond the single source follow-up is rejected at parse (count/order preserved).
eq(parseEditorResponse(judgmentCanonical as any, "zh-Hant", editorOk("zh-Hant", "judgment", { answer: "a。", planet_factor: "b。", house_factor: "c。", synthesis: "d。", watch_out: "留意語氣，避免過急。", followup_1: "問題一？", followup_2: "多咗一條？" })).kind, "invalid", "RG2: an EXTRA follow-up (followup_2) beyond the single source follow-up is rejected at parse (count/order preserved)");

/* ================================================================================================
 * CAUTION / ACTION SEMANTICS ARE THE CHECKER'S JOB (fourth review, C03). The earlier RG2 guards used a
 * lexical negation-window heuristic (ALL_CLEAR / polarityReversed) to hard-reject a reversed or inverted
 * caution/action BEFORE Stage 4. That heuristic false-rejected faithful negation paraphrases — e.g.
 * "…permanently lost…" → "…gone…" — whose window shifts without changing meaning, stopping a
 * structurally valid candidate from ever reaching the mandatory meaning checker. C03 removes those hard
 * rejects: assembly now enforces only STRUCTURAL / PROVENANCE constraints (schema/identity/caps, required
 * sections, the sentence-fragment check, and — for Location — selected-evidence places + server-owned
 * search order), and a real reversal/inversion is caught by the checker's 'changes' verdict → validated
 * fallback (proved in the contract test). So the cases below now PASS assembly.
 * ================================================================================================ */
const faithFactors = { answer: "Your side helps, but the setting is hard.", planet_factor: "Your own capacity is a genuine strength working in your favour.", house_factor: "The surrounding setting is difficult and adds friction.", synthesis: "Real support on one side, real difficulty on the other; the two stay separate." };
const pressureJudg = Object.freeze({ ...(mixedJudg as any), watch_out: "Avoid putting pressure on the other person.", suggested_followups: [] });
// C03: a caution whose polarity looks reversed ("avoid pressure" → "put pressure") is NOT hard-rejected at
// assembly any more; it reaches the checker, which returns 'changes' → fallback (contract test).
ok(asm(pressureJudg, "en", "judgment", { ...faithFactors, watch_out: "Avoid giving the other person space; put pressure on them." }, judgmentLanding).ok, "C03 EN: an apparent caution reversal passes ASSEMBLY (semantic decision routed to the checker)");
const pressureJudgZh = Object.freeze({ ...(judgmentCanonical as any), watch_out: "不要向對方施壓。", suggested_followups: [] });
ok(asm(pressureJudgZh, "zh-Hant", "judgment", { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。", watch_out: "注意繼續向對方施壓。" }, judgmentLanding).ok, "C03 zh: an apparent caution reversal passes ASSEMBLY (checker decides)");
// C03: a practical step whose polarity looks reversed passes assembly (checker decides).
ok(asm(personCanonical, "en", "person", { answer: "A careful person.", explanation: "This points to someone steady and dependable.", practical_step: "Pressure them and withhold clear information." }, personLanding).ok, "C03 EN: an apparent practical-step reversal passes ASSEMBLY (checker decides)");
// C03 EXACT review pair (isolated in a Person canonical, as the review did): a FAITHFUL negation
// paraphrase "…permanently lost…" → "…gone…" now passes assembly (previously DICE_COPY_CAUTION_REVERSED).
{
  const lostPerson = Object.freeze({ ...(personCanonical as any), watch_out: "Do not assume it is permanently lost before a careful look." });
  ok(asm(lostPerson, "en", "person", { answer: "A careful person.", explanation: "This points to someone steady and dependable.", practical_step: "Give them clear, concrete information rather than pressure.", watch_out: "Do not assume it is gone before a careful look." }, personLanding).ok, "C03 EN exact pair: '…permanently lost…' → '…gone…' now passes assembly (was falsely rejected)");
  // A faithful HK-Traditional negation paraphrase likewise passes.
  const lostPersonZh = Object.freeze({ ...(personCanonical as any), language: "zh-Hant", synthesis: "呢個人小心務實，會透過穩定可靠嘅行動慢慢建立信任。", watch_out: "唔好喺仔細搵之前就假設樣嘢冇咗。", practical_step: "俾清楚具體嘅資料，多過施壓。" });
  ok(asm(lostPersonZh, "zh-Hant", "person", { answer: "一個小心務實的人。", explanation: "會透過穩定可靠的行動慢慢建立信任。", practical_step: "給清楚具體的資料，而不是施壓。", watch_out: "在仔細找之前，不要假設東西已經不見了。" }, personLanding).ok, "C03 zh: a faithful HK-Traditional negation paraphrase passes assembly");
}
// C04 (P06/P07 → R02): the search step is now edited PER CANDIDATE and assembled in canonical rank
// order, so a rank-2-first ordering is unexpressible; a slot-1 phrase naming the rank-2 place, or one
// negating the rank-1 place, is rejected (covered in the R02 location block above). Order contradiction
// with the candidate list shown beside it is structurally impossible.
// C04 (P08): a newly-editable Location CAUTION that introduces an unsupported place is rejected.
eq(asm(locationCanonical, "en", "location", { clues: "A private indoor spot at home.", watch_out: "Beware of leaving it at the airport." }, locationLanding), { ok: false, reason: "DICE_COPY_CAUTION_UNSUPPORTED_PLACE" }, "C04/P08: an unsupported place introduced in the editable Location caution is rejected");
// R01 (N03): a FAITHFUL caution that keeps the same negated action across a clause boundary is ACCEPTED
// (clause-scoped negation — an earlier-clause negator does not spuriously flip a later token).
ok(asm(pressureJudg, "en", "judgment", { ...faithFactors, watch_out: "Give them space and avoid pressure." }, judgmentLanding).ok, "R01/N03 EN: a faithful caution ('...and avoid pressure') is accepted (clause-scoped negation)");
// R01 (N04): a DIRECT reversal in a later clause is rejected (the earlier 'Avoid' does not scope to it).
ok(asm(pressureJudg, "en", "judgment", { ...faithFactors, watch_out: "Avoid haste. Apply pressure." }, judgmentLanding).ok, "C03 EN: a later-clause reversal ('Avoid haste. Apply pressure.') passes ASSEMBLY (the checker decides the semantics)");
// B04 (independent review): the former zero-shared-token "DICE_COPY_CAUTION_LOST" floor is REMOVED. A
// faithful synonym caution that shares NO words with its source now PASSES assembly and is routed to the
// mandatory Stage-4 checker (whether it truly preserves the warning — or drifts into an unrelated
// statement — is a SEMANTIC judgement the checker makes; the composition/Web tests cover display-on-
// preserves and fallback-on-changes). Only the high-confidence STRUCTURAL guards remain hard here.
ok(asm(pressureJudg, "en", "judgment", { ...faithFactors, watch_out: "Do not push them." }, judgmentLanding).ok, "B04 EN: a faithful synonym caution ('Avoid putting pressure…' → 'Do not push them.') with zero shared words now passes assembly (routed to the checker), not hard-rejected");
{ // The exact review example: "Avoid pressure." → "Do not push."
  const avoidJudg = Object.freeze({ ...(mixedJudg as any), watch_out: "Avoid pressure.", suggested_followups: [] });
  ok(asm(avoidJudg, "en", "judgment", { ...faithFactors, watch_out: "Do not push." }, judgmentLanding).ok, "B04 EN: the exact review example 'Avoid pressure.' → 'Do not push.' passes assembly");
}
// A faithful zh synonym caution (zero shared tokens) likewise passes assembly.
ok(asm(Object.freeze({ ...(judgmentCanonical as any), watch_out: "留意跟進時的語氣，不要催逼對方。", suggested_followups: [] }), "zh-Hant", "judgment", { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。", watch_out: "不要迫得太緊。" }, judgmentLanding).ok, "B04 zh: a faithful zh synonym caution ('不要催逼對方' → '不要迫得太緊') passes assembly");
// An UNRELATED replacement is ALSO not hard-rejected at assembly any more — it reaches the checker,
// which returns 'changes' → fallback (verified at the composition/Web boundary, see the contract test).
// C03: an unrelated replacement AND an all-clear inversion BOTH pass assembly now — the checker makes
// the semantic call ('changes' → fallback), verified in the contract test's C03 composition cases.
ok(asm(pressureJudg, "en", "judgment", { ...faithFactors, watch_out: "This concerns the general tone of the matter." }, judgmentLanding).ok, "C03 EN: an unrelated caution replacement passes assembly (routed to the checker)");
ok(asm(pressureJudg, "en", "judgment", { ...faithFactors, watch_out: "Everything is fine, no need to be careful." }, judgmentLanding).ok, "C03 EN: an all-clear inversion passes assembly (the checker, not a lexical heuristic, rejects it)");
// C05 (P04) EN swap: two follow-ups exchanged between positions are rejected (relative slot anchoring).
const enTwoFollowup = Object.freeze({ ...(enJudgment as any), suggested_followups: ["What should I prepare first?", "When is the best time to raise it?"] });
const enTwoFactors = { answer: "You have real support, and the setting is favourable.", planet_factor: "Your own capacity is strong and works in your favour.", house_factor: "The situation around you is also supportive and helps.", synthesis: "The two sides agree here rather than pulling against each other." };
eq(asm(enTwoFollowup, "en", "judgment", { ...enTwoFactors, followup_1: "When is the best time to raise it?", followup_2: "What should I prepare first?" }, judgmentLanding), { ok: false, reason: "DICE_COPY_FOLLOWUP_ORDER" }, "C05/P04 EN: two follow-ups swapped between positions are rejected (relative slot anchoring)");
// C05 (P15) zh swap.
eq(asm(twoFollowupJudgment, "zh-Hant", "judgment", { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。", followup_1: "我應該幾時提出？", followup_2: "我可以點樣改善溝通？" }, judgmentLanding), { ok: false, reason: "DICE_COPY_FOLLOWUP_ORDER" }, "C05/P15 zh: two follow-ups swapped between positions are rejected");
// R03 (N01/N02): a FAITHFUL single-slot paraphrase with low LITERAL overlap is ACCEPTED (no absolute
// overlap floor — literal overlap is not proof of changed intent). Single-slot unrelated replacement
// (former P05) is NOT reliably caught by literal means and is disclosed as RG3 (see 11-...md), NOT
// asserted to display.
{
  const n1 = Object.freeze({ ...(mixedJudg as any), suggested_followups: ["What should I prepare first?"] });
  ok(asm(n1, "en", "judgment", { ...faithFactors, followup_1: "What do I need to get ready before anything else?" }, judgmentLanding).ok, "R03/N01 EN: a faithful single-slot follow-up paraphrase is accepted (no literal-overlap floor)");
  ok(asm(judgmentCanonical, "zh-Hant", "judgment", { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。", followup_1: "有咩方法可以令我同人溝通得更好？" }, judgmentLanding).ok, "R03/N02 zh: a faithful single-slot follow-up paraphrase is accepted");
}
// R03 control: a FAITHFUL two-slot rewrite (each keeps its own slot's intent) is accepted, not swapped.
ok(asm(enTwoFollowup, "en", "judgment", { ...enTwoFactors, followup_1: "What is the first thing to prepare?", followup_2: "When is the best moment to bring it up?" }, judgmentLanding).ok, "R03 control: a faithful two-slot follow-up rewrite is accepted (each matches its own slot)");
// C05 (P14): a zh DECLARATIVE is not a question just because it contains 可以.
eq(asm(judgmentCanonical, "zh-Hant", "judgment", { answer: "外在有利，但你的處理是關鍵。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "兩邊分開理解，各有作用。", followup_1: "你可以繼續努力。" }, judgmentLanding), { ok: false, reason: "DICE_COPY_FOLLOWUP_NOT_QUESTION" }, "C05/P14 zh: a declarative containing 可以 is NOT accepted as a follow-up question");
// C06 (P11): a Chinese mid-paragraph fragment (no space after 。) is caught as its own sentence now.
eq(asm(judgmentCanonical, "zh-Hant", "judgment", { answer: "外在有利。", planet_factor: "你這面比較吃力，容易遇到阻力。", house_factor: "周圍環境對你有利，有支持。", synthesis: "你本身有能力，因為。這對事情有幫助。" }, judgmentLanding).ok, false, "C06/P11 zh: a mid-paragraph Chinese fragment ('…因為。這…') is rejected (segmentation no longer needs whitespace)");
// C07 (P10): a faithful caution paraphrase (no polarity flip) IS accepted — covered above for judgment;
// here for a Level-1 caution: "reserved before settled" → "reserved until settled".
ok(asm(personCanonical, "en", "person", { answer: "A careful person.", explanation: "Steady and dependable.", watch_out: "They might appear reserved until they feel settled." }, personLanding).ok, "C07/P10 EN: a faithful caution paraphrase (no reversal) is accepted, not falsely rejected");
// C07 (P12): a NEGATED opposite phrase ("does not work against you") on a favourable factor is NOT a reversal.
ok(asm(mixedJudg, "en", "judgment", { ...faithFactors, planet_factor: "Your own strength does not work against you; it supports your progress." }, judgmentLanding).ok, "C07/P12 EN: a negated opposite phrase on a favourable factor is accepted (negation-aware, not flagged as opposition)");

/* ---- Stage-3 EDITOR input + assembled-envelope token measurement (honest allowance labels, M03). ---- */
for (const [mode, canonical, q, landing] of [["judgment", judgmentCanonical, "我個application會唔會批？", judgmentLanding], ["timing", timingCanonical, "幾時會有結果？", timingLanding], ["location", locationCanonical, "喺邊度？", locationLanding], ["person", personCanonical, "係咩人？", personLanding]] as const) {
  const providerInput = `${DICE_V05_EDITOR_BLOCK}\nINPUT_JSON:\n${JSON.stringify(buildEditorInput(canonical as any, q, landing))}`;
  const inTok = measureDiceTokenLimit(providerInput, 100000).token_count;
  const fb = buildValidatedFallback(canonical as any, landing);
  const envTok = fb.ok ? measureDiceTokenLimit(JSON.stringify(fb.copy), CUSTOMER_COPY_OUTPUT_CAP) : { token_count: -1, within_limit: false };
  ok(fb.ok, `${mode} deterministic envelope builds`);
  ok(envTok.within_limit, `${mode} assembled display envelope within the 700-token cap (tokens=${envTok.token_count})`);
  // Three DISTINCT limits, kept separate (independent-review correction #6):
  //   (1) editor INPUT tokens — the provider PROMPT, bounded by the model's INPUT/context window; it is
  //       NOT bounded by the 2,000-token GENERATION allowance (that caps generated OUTPUT) NOR by the
  //       700-token display-output cap;
  //   (2) the RAW editor OUTPUT is measured against the 700-token cap BEFORE parse (in execution);
  //   (3) the assembled DISPLAY envelope is measured against the same 700-token cap here.
  // The number below is (1) input measurement and (3) the assembled display envelope; it is a
  // representative sample, not a mathematical worst case.
  console.log(`stage3-io ${mode}: editor_input_tokens=${inTok} (runtime tokenizer, real INPUT_JSON; bounded by the model INPUT/context window — NOT the 2000-token generation allowance and NOT the 700 display-output cap), display_envelope_tokens=${envTok.token_count} cap=${CUSTOMER_COPY_OUTPUT_CAP} (assembled display OUTPUT; representative fixture, not a mathematical worst case)`);
}

console.log("dice-v0-5 customer-copy fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
