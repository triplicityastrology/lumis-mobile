/** Workbook QA fixtures (node-runnable; MOCK provider text, no network).
 * D03 correction: the exact workbook rows T5 / T7 / T8 are now produced by driving the REAL
 * two-stage window (gate → landing → assembler → final validator) with mocked provider TEXT, not by
 * hand-written canonicals. The structured dignity + House fortune come from the production fixed-data
 * (resolved by the assembler), and every canonical is checked with validateDiceV05FinalResult. The
 * deterministic customer copy is then built from that real canonical. Defect-class checks
 * (fragments, ranks, timing formulas, blended grades) remain as GENERIC illustrations. Location rows
 * exercise a MOCK canonical only; real end-to-end Location stays BLOCKED_BY_SEPARATE_WHERE_BASE. */
import {
  prohibitedLanguageCheck, completenessCheck, preservationCheck, sourceParityCheck,
  deterministicCustomerCopy, buildValidatedFallback, validateLocationProjection,
  parseCustomerCopy, DICE_V05_CUSTOMER_COPY_SCHEMA, type DiceV05CustomerCopy,
} from "../_shared/dice-v0-5-customer-copy.ts";
import { executeDiceV05FreeTextCaseWithCopy } from "../_shared/dice-v0-5-window-with-copy.ts";
import { executeDiceV05FreeTextCase, parseDiceV05FreeTextRequest, type DiceV05ProviderAdapter } from "../_shared/dice-v0-5-window.ts";
import { validateDiceV05FinalResult, validateLocation, type DiceV05Mode } from "../_shared/dice-v0-5-interpretation-contract.ts";
import { buildLocationResolution, assembleLocation } from "../_shared/dice-v0-5-presentation.ts";
import { dignityOf } from "../_shared/dice-v0-5-fixed-data.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

// Drive the REAL window for one exact workbook request with mocked Stage-1 (mode) + Stage-2 (prose).
async function realCanonical(mode: DiceV05Mode, req: any, stage2: Record<string, unknown>): Promise<any> {
  const parsed = parseDiceV05FreeTextRequest(req);
  ok(parsed, `request parses for ${JSON.stringify(req)}`);
  const matchedRule = mode === "judgment" ? "STEP_3_JUDGMENT" : mode === "timing" ? "STEP_1_TIMING" : mode === "location" ? "STEP_2_LOCATION" : "STEP_4_LEVEL1";
  const adapter: DiceV05ProviderAdapter = {
    invoke: async (r) => r.schema_name === "lumis_dice_mode_selection_v5"
      ? { kind: "success", content: JSON.stringify({ mode, matched_rule: matchedRule }) }
      : { kind: "success", content: JSON.stringify(stage2) },
  };
  const out = await executeDiceV05FreeTextCase(parsed!, () => adapter, () => 1000);
  ok(out.kind === "completed", `real window completes for ${mode}`);
  if (out.kind !== "completed") throw new Error("unreachable");
  eq(validateDiceV05FinalResult(out.result), "OK", `real canonical for ${mode} passes validateDiceV05FinalResult`);
  return out.result;
}

// Parse the `given` envelope actually delivered to the Stage-2 provider from the captured prompt
// (buildProviderInput serializes it after an "INPUT_JSON:\n" marker).
function parseStage2Given(prompt: string): any {
  const marker = "INPUT_JSON:\n";
  const idx = prompt.indexOf(marker);
  ok(idx >= 0, "captured Stage-2 prompt carries INPUT_JSON");
  return JSON.parse(prompt.slice(idx + marker.length)).given;
}

// F07: drive the REAL window for a Timing landing while CAPTURING the exact Stage-2 request, then
// assert the timing envelope (planet_speed / house_speed / combined_pace) the PRODUCTION resolver
// actually delivered — not merely the mocked prose. `expected` is stated independently from the
// approved authority (review C11); the mock band word is tied to `expected.combined_pace`, so a
// deliberate swap of buildTimingEnvelope/combinedPaceV05 (Pluto medium→fast, Moon fast→medium)
// makes this FAIL. Returns the assembled canonical.
const PACE_BAND_ZH: Record<string, string> = { fast: "偏快", medium: "中等", slow: "偏慢" };
async function realTimingCanonical(req: any, expected: { planet_speed: string; house_speed: string; combined_pace: string }, stage2: Record<string, unknown>): Promise<any> {
  const parsed = parseDiceV05FreeTextRequest(req);
  ok(parsed, `timing request parses for ${JSON.stringify(req)}`);
  let capturedGiven: any = null;
  const adapter: DiceV05ProviderAdapter = {
    invoke: async (r) => {
      if (r.schema_name === "lumis_dice_mode_selection_v5") return { kind: "success", content: JSON.stringify({ mode: "timing", matched_rule: "STEP_1_TIMING" }) };
      capturedGiven = parseStage2Given(r.prompt);
      return { kind: "success", content: JSON.stringify(stage2) };
    },
  };
  const out = await executeDiceV05FreeTextCase(parsed!, () => adapter, () => 1000);
  ok(out.kind === "completed", "real timing window completes");
  if (out.kind !== "completed") throw new Error("unreachable");
  eq(validateDiceV05FinalResult(out.result), "OK", "real timing canonical passes validateDiceV05FinalResult");
  ok(capturedGiven, "the real Stage-2 timing request was captured");
  // The heart of F07: assert the ACTUAL envelope the production resolver delivered to Stage 2.
  eq(capturedGiven.planet_speed, expected.planet_speed, `timing planet_speed is the production value '${expected.planet_speed}' (fails if the speed table is swapped)`);
  eq(capturedGiven.house_speed, expected.house_speed, `timing house_speed is the production value '${expected.house_speed}'`);
  eq(capturedGiven.combined_pace, expected.combined_pace, `timing combined_pace is the production value '${expected.combined_pace}' (fails if combinedPaceV05 is swapped)`);
  // Tie the mocked band word to the approved combined_pace so the mock cannot silently disagree.
  ok(String((stage2 as any).timing_summary).includes(PACE_BAND_ZH[expected.combined_pace]), `mocked timing prose carries the band '${PACE_BAND_ZH[expected.combined_pace]}' matching the production combined_pace`);
  return out.result;
}

// A prohibited/fragment copy generator for the GENERIC "defect must be caught" rows.
const copy = (language: "en" | "zh-Hant", mode: DiceV05Mode, o: Partial<DiceV05CustomerCopy>): DiceV05CustomerCopy => ({
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", language, question_mode: mode, headline: "H.", reading: "R.", watch_out: null, practical_step: null, suggested_followups: mode === "judgment" ? ["Q?"] : [], ...o,
});

async function main() {
  /* ================= D03: EXACT workbook rows via the REAL production authority ================= */

  // --- T5 EXACT: Jupiter / Sagittarius / House 1, 我應唔應該去Working holiday？ (judgment). ---
  const t5 = await realCanonical("judgment", { question: "我應唔應該去Working holiday？", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" }, {
    status: "ok", planet_prose: "木星本身強而有力，鼓勵你向外拓展、把握成長機會。", house_prose: "第一宮把主動權放在你自己手上，行動由你主導。",
    synthesis: "整體方向支持你踏出這一步，但仍要把計劃保持務實。", watch_out: "不要讓樂觀蓋過實際準備。", suggested_followups: ["我應該先準備甚麼？"],
  });
  // The dignity + House fortune are resolved by the production fixed-data (NOT hand-written).
  eq(dignityOf("jupiter", "sagittarius").dignity, "ruler", "T5 dignity is the production value 'ruler' (not a guessed 'domicile')");
  eq(t5.planet_side.dignity, "ruler", "T5 assembled planet_side.dignity is 'ruler' from the real bank");
  eq(t5.house_side.fortune, "great_fortune", "T5 assembled House-1 fortune is 'great_fortune' from the real bank");
  const t5copy = buildValidatedFallback(t5);
  ok(t5copy.ok, "T5 deterministic copy is valid");
  ok(t5copy.ok && t5copy.copy.reading.includes("木星") && t5copy.copy.reading.includes("第一宮") && t5copy.copy.reading.includes("整體方向"), "T5 copy keeps both factors + synthesis");
  ok(t5copy.ok && prohibitedLanguageCheck(t5copy.copy) === "OK", "T5 copy leaks no raw dignity/fortune label (大吉/守護)");

  // --- T7 EXACT: Pluto / Sagittarius / House 1 → planet slowest × house fast = MEDIUM (asserted on
  //     the REAL captured Stage-2 envelope, so a speed/pace swap fails here). ---
  const t7 = await realTimingCanonical({ question: "呢單生意幾時會有結果？", planet_id: "pluto", sign_id: "sagittarius", house_id: "house_1" },
    { planet_speed: "slowest", house_speed: "fast", combined_pace: "medium" }, {
    status: "ok", timing_summary: "進度屬於中等，不會即時有結果，但亦不會長期停滯。",
    synthesis: "冥王星本身的節奏非常慢，但第一宮把事情放到你自己手上，會推動並加快整體進程，所以最終落在中等。", watch_out: null,
  });
  const t7copy = buildValidatedFallback(t7);
  ok(t7copy.ok && t7copy.copy.headline.includes("中等"), "T7 copy preserves the MEDIUM band");
  ok(t7copy.ok && t7copy.copy.reading.includes("非常慢") && t7copy.copy.reading.includes("加快"), "T7 keeps very-slow inherent pace + accelerating House 1");

  // --- T8 EXACT: Moon / Sagittarius / House 1 → planet fastest × house fast = FAST (DISTINCT from T7;
  //     asserted on the REAL captured Stage-2 envelope). ---
  const t8 = await realTimingCanonical({ question: "我份新工幾時會有進展？", planet_id: "moon", sign_id: "sagittarius", house_id: "house_1" },
    { planet_speed: "fastest", house_speed: "fast", combined_pace: "fast" }, {
    status: "ok", timing_summary: "進度屬於偏快，通常會較早見到變化。",
    synthesis: "月亮本身節奏很快，第一宮亦讓事情由你主導，兩者相加令整體進展相對快。", watch_out: null,
  });
  const t8copy = buildValidatedFallback(t8);
  ok(t8copy.ok && t8copy.copy.headline.includes("偏快"), "T8 copy preserves the FAST band");
  ok(t7.timing_summary !== t8.timing_summary && t7copy.ok && t8copy.ok && t7copy.copy.headline !== t8copy.copy.headline, "T7 (medium) and T8 (fast) are DISTINCT canonicals AND outputs");

  /* ================= GENERIC defect-class illustrations (labelled generic) ================= */
  const recorded: string[] = [];
  const rec = (id: string, mode: DiceV05Mode) => recorded.push(`${id}:${mode}`);
  const recGeneric = (id: string) => recorded.push(`${id}:generic`);
  rec("T5", "judgment"); rec("T7", "timing"); rec("T8", "timing");

  // T2 (generic): fragment tails rejected with and without a trailing period.
  ok(completenessCheck(copy("en", "person", { headline: "Steady.", reading: "Beware of overex" })) !== "OK", "T2(generic) 'Beware of overex' rejected");
  ok(completenessCheck(copy("en", "person", { headline: "Steady.", reading: "Beware of overex." })) !== "OK", "T2(generic) 'Beware of overex.' still rejected");
  ok(completenessCheck(copy("en", "person", { headline: "Steady.", reading: "They tend to be careful and." })) !== "OK", "T2(generic) dangling 'and.' rejected");
  recGeneric("T2");
  // T4 / T4.1 / T10 (generic): abrupt endings and raw rank rejected.
  ok(completenessCheck(copy("en", "judgment", { headline: "Weigh both sides.", reading: "It leans supportive with room for carefree play", watch_out: "Stay grounded." })) !== "OK", "T4(generic) abrupt 'carefree play' rejected");
  ok(prohibitedLanguageCheck(copy("en", "judgment", { headline: "It can grow.", reading: "This sits on rank 7 of the houses.", watch_out: "Communicate openly." })) !== "OK", "T4.1/T10(generic) raw 'rank 7' rejected");
  recGeneric("T4"); recGeneric("T4.1"); recGeneric("T10");
  // T8.1 (generic): raw 大吉 rejected. T7/T8 speed formula rejected.
  ok(prohibitedLanguageCheck(copy("zh-Hant", "judgment", { headline: "大吉。", reading: "整體大吉。", watch_out: "留意。" })) !== "OK", "T8.1(generic) 大吉 rejected");
  ok(prohibitedLanguageCheck(copy("en", "timing", { headline: "The pace is medium.", reading: "This is planet_speed x house_speed overall." })) !== "OK", "T7 speed formula rejected");
  ok(prohibitedLanguageCheck(copy("en", "timing", { headline: "It is quick.", reading: "fastest x fast -> fast is the result." })) !== "OK", "T8 'fastest x fast -> fast' rejected");
  recGeneric("T8.1");

  // T9 job type via the REAL window (English controlling equivalent): stays thing_or_situation.
  const t9 = await realCanonical("thing_or_situation", { question: "What kind of job should I look for?", planet_id: "mercury", sign_id: "libra", house_id: "house_4" }, {
    status: "ok", synthesis: "This kind of work suits a careful, methodical person who can build expertise steadily over time.", watch_out: "A chaotic, fast-changing setting can scatter your focus.", practical_step: "Choose one stable direction and build a track record first.",
  });
  const t9copy = buildValidatedFallback(t9);
  eq(t9.question_mode, "thing_or_situation", "T9 stays thing_or_situation");
  ok(t9copy.ok && preservationCheck(t9copy.copy, t9) === "OK", "T9 copy preserves mode/language");
  rec("T9", "thing_or_situation");

  // T6 bundled: Stage 3 (and the copy provider) must NOT run; deterministic mode never calls a copy provider.
  const bundledReq = parseDiceV05FreeTextRequest({ question: "我個application會唔會批？幾時會批？", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" });
  ok(bundledReq, "T6 bundled request parses");
  const throwAdapter: DiceV05ProviderAdapter = { invoke: async () => { throw new Error("provider must not be called for a bundled question"); } };
  const bundled = await executeDiceV05FreeTextCaseWithCopy(bundledReq!, () => throwAdapter, () => 1000);
  eq(bundled.kind, "bundled", "T6 stays bundled at Stage 0");
  ok(!("customer_copy" in (bundled as any)), "T6 no customer copy");
  eq((bundled as any).provider_calls, 0, "T6 zero provider calls");
  rec("T6", "bundled" as DiceV05Mode);

  // T12 / T12.1 / T12.2 Location — MOCK canonical built from the REAL resolver + wire validator +
  // assembler (no fabricated placeholder IDs, per G02); real end-to-end still BLOCKED_BY_SEPARATE_WHERE_BASE.
  const locThrow = { planet: "moon", sign: "leo", house: 4 } as const;
  const locResolution = buildLocationResolution("en", locThrow.planet, locThrow.sign, locThrow.house);
  const locKeys = locResolution.selectedKeys;
  const locWire = { status: "ok", most_likely_area: "Most likely a quiet storage spot at home.",
    synthesis: "The Moon points to a private, domestic setting, so begin indoors.",
    location_candidates: [
      { rank: 1, place: "the bedroom", evidence: { p: [locKeys.p[0]], h: [], e: [] } },
      { rank: 2, place: "the kitchen", evidence: { p: [], h: [locKeys.h[0]], e: [] } },
    ],
    extension: null, search_order: [1, 2],
    watch_out: "Do not assume it is permanently lost.", practical_step: "Start with the bedroom, then the kitchen." };
  eq(validateLocation(locWire as any, locKeys), "OK", "T12* real Location wire baseline validates against selected keys");
  const locCanonical = assembleLocation("en", locWire, locResolution.gid);
  eq(validateDiceV05FinalResult(locCanonical), "OK", "T12* assembled Location canonical passes the final validator");
  // Projection validated WITH the trusted landing → provenance is exercised on real IDs.
  eq(validateLocationProjection(locCanonical as any, locThrow), "OK", "T12* Location projection passes with the trusted landing (approved selected IDs)");
  const locFb = buildValidatedFallback(locCanonical as any);
  ok(locFb.ok, "T12* location deterministic copy valid");
  ok(locFb.ok && sourceParityCheck(locFb.copy, locCanonical as any) === "OK", "T12* location copy preserves caution/step/follow-ups");
  // A wrong-planet source is rejected by the provenance check even in the MOCK workbook.
  const venusGid = buildLocationResolution("en", "venus", "leo", 4);
  const locBadProv = { ...locCanonical, location_candidates: [{ ...(locCanonical as any).location_candidates[0], evidence: { planet_ids: [venusGid.gid[venusGid.selectedKeys.p[2]]], house_ids: [], element_ids: [] } }, (locCanonical as any).location_candidates[1]] };
  ok(validateLocationProjection(locBadProv as any, locThrow) !== "OK", "T12* a wrong-planet source is rejected by the trusted-landing provenance check");
  for (const id of ["T12", "T12.1", "T12.2"]) { rec(id, "location"); console.log(`${id}: Stage-3 Location copy checked on MOCK canonical (real resolver IDs) — real end-to-end BLOCKED_BY_SEPARATE_WHERE_BASE`); }

  console.log("question_mode recorded per row:", recorded.join(" "));
  console.log("dice-v0-5 workbook customer-copy fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
