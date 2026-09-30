/** lumis_dice_fidelity_eval_v1 — production-input + self-consistency validation of the FIXED evaluation
 * set (reviews B07 + C05). These checks prove every row is BUILT FROM VALID PRODUCTION INPUTS and is
 * internally consistent; they do NOT run a live model, so they make NO claim about real semantic-detection
 * accuracy (the deferred, separately-authorised comparison). For every row this asserts:
 *  - `source` is a schema-VALID final interpretation whose mode/language match the row;
 *  - the row carries a synthetic question and a trusted landing;
 *  - the COMPLETE editor wire (`proposed`) PARSES with the production editor parser (so a missing
 *    follow-up or the Timing pace_band control echo is caught here, not silently);
 *  - Location sources pass validateLocationProjection against their landing (real selected evidence);
 *  - a SEMANTIC row ASSEMBLES (reaches the checker); a STRUCTURAL_GATE row FAILS assembly with its
 *    declared `gate` code (rejected before Stage 4);
 *  - `expected` keys are EXACTLY the server-derived required checks; every verdict is a legal enum;
 *  - label ⇔ verdicts (positive ⟺ all preserves); a positive additionally builds a within-cap checker
 *    comparison input and passes display validation;
 *  - full CARTESIAN coverage: each of the six modes × both languages carries a semantic positive AND a
 *    semantic negative; the named defect categories are present.
 * The internal-dice-ai-lab contract additionally drives representative positives through the REAL Web.
 */
import { DICE_V05_FIDELITY_EVAL_V1, DICE_V05_FIDELITY_EVAL_SCHEMA } from "./dice-v0-5-copy-fidelity-eval-v1.ts";
import { fidelityCheckKeys, buildFidelityInput, buildFidelityProviderInput, fidelityComponentsFromWire, CHECKER_INPUT_CAP } from "./dice-v0-5-copy-fidelity.ts";
import {
  DICE_V05_EDITOR_SCHEMA, parseEditorResponse, assembleEditorCopy, validateDisplayCopy,
  validateLocationProjection, type Landing,
} from "./dice-v0-5-customer-copy.ts";
import { validateDiceV05FinalResult, DICE_V05_MODES } from "./dice-v0-5-interpretation-contract.ts";
import { buildJudgmentEnvelope } from "./dice-v0-5-presentation.ts";
import type { DiceV05PlanetId, DiceV05SignId } from "./dice-v0-5-fixed-data.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

const rows = DICE_V05_FIDELITY_EVAL_V1;
ok(DICE_V05_FIDELITY_EVAL_SCHEMA === "lumis_dice_fidelity_eval_v1", "eval schema id");
ok(rows.length >= 24, `the fixed eval set has enough rows (${rows.length})`);

const seenIds = new Set<string>();
const cell = new Map<string, { pos: number; neg: number }>();     // "mode/lang" → semantic pos/neg counts
const categories = new Set<string>();
let semanticPos = 0, semanticNeg = 0, gateRows = 0;

for (const row of rows) {
  ok(/^FID-EVAL-V1-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(row.id), `row id is stably prefixed: ${row.id}`);
  ok(!seenIds.has(row.id), `row id is unique: ${row.id}`);
  seenIds.add(row.id);
  ok((DICE_V05_MODES as readonly string[]).includes(row.mode), `row ${row.id} names a real mode`);
  ok(row.language === "en" || row.language === "zh-Hant", `row ${row.id} names a supported language`);
  ok(typeof row.question === "string" && row.question.length > 3, `row ${row.id} carries a synthetic question`);
  ok(row.landing && typeof row.landing.planet === "string" && typeof row.landing.house === "number", `row ${row.id} carries a trusted landing`);
  ok(typeof row.rationale === "string" && row.rationale.length > 10, `row ${row.id} carries a rationale`);
  categories.add(row.category);

  // Source validity + identity.
  eq(validateDiceV05FinalResult(row.source as any), "OK", `row ${row.id}: source is a schema-valid final interpretation`);
  eq((row.source as any).question_mode, row.mode, `row ${row.id}: source mode matches`);
  eq((row.source as any).language, row.language, `row ${row.id}: source language matches`);

  const landing: Landing = { planet: row.landing.planet as DiceV05PlanetId, sign: row.landing.sign as DiceV05SignId, house: row.landing.house };
  if (row.mode === "location") eq(validateLocationProjection(row.source as any, landing), "OK", `row ${row.id}: Location source has valid selected-evidence provenance (validateLocationProjection)`);

  // The COMPLETE editor wire must parse with the production parser (catches missing followup / pace_band).
  const wire = { schema: DICE_V05_EDITOR_SCHEMA, status: "ok", language: row.language, question_mode: row.mode, ...row.proposed };
  const parsed = parseEditorResponse(row.source as any, row.language, JSON.stringify(wire));
  eq(parsed.kind, "ok", `row ${row.id}: the complete editor wire parses (${(parsed as any).code ?? "ok"})`);

  // D01-C: for EVERY Judgment row, the fixed Planet/dignity/House values must equal the PRODUCTION
  // resolution for that row's exact landing (reuse the resolver — never a second copied astrology table).
  if (row.mode === "judgment") {
    const g: any = buildJudgmentEnvelope(row.language, "", landing.planet, landing.sign, landing.house).given;
    const ps: any = (row.source as any).planet_side, hs: any = (row.source as any).house_side;
    eq(ps.fortune, g.planet_fortune, `row ${row.id}: planet fortune matches production resolution`);
    eq(ps.dignity, g.dignity, `row ${row.id}: planet dignity matches production resolution`);
    eq(ps.dignity_zh, g.dignity_zh, `row ${row.id}: planet dignity_zh matches production resolution`);
    eq(ps.dignity_emphasis, g.dignity_emphasis, `row ${row.id}: planet dignity_emphasis matches production resolution`);
    eq(hs.fortune, g.house_fortune, `row ${row.id}: house fortune matches production resolution for the landing`);
    eq(hs.fortune_zh, g.house_fortune_zh, `row ${row.id}: house fortune_zh matches production resolution`);
    eq(hs.rank, g.house_rank, `row ${row.id}: house rank matches production resolution for the landing`);
  }

  // Assembly + display. A SEMANTIC row must pass BOTH assembly AND display (D01-A #1) so it genuinely
  // reaches Stage 4. A STRUCTURAL_GATE row is rejected before Stage 4 at its declared STAGE:
  //  - stage "assembly" (default): assembleEditorCopy fails with the gate code.
  //  - stage "display": assembleEditorCopy passes, validateDisplayCopy fails with the gate code.
  const asm = parsed.kind === "ok" ? assembleEditorCopy(row.source as any, parsed.value, landing) : { ok: false as const, reason: "PARSE" };
  if (row.kind === "semantic") {
    ok(asm.ok, `row ${row.id}: a SEMANTIC row assembles — got ${(asm as any).reason ?? "ok"}`);
    if (asm.ok) eq(validateDisplayCopy(asm.copy, row.source as any, landing, true), "OK", `row ${row.id}: a SEMANTIC row passes display validation (genuinely reaches the checker)`);
  } else {
    const stage = row.stage ?? "assembly";
    if (stage === "assembly") {
      ok(!asm.ok, `row ${row.id}: an ASSEMBLY structural_gate row fails assembly before Stage 4`);
      eq((asm as any).reason, row.gate, `row ${row.id}: the assembly gate code matches the declared gate`);
    } else {
      ok(asm.ok, `row ${row.id}: a DISPLAY structural_gate row parses + assembles`);
      const dv = asm.ok ? validateDisplayCopy(asm.copy, row.source as any, landing, true) : "NOT-ASSEMBLED";
      eq(dv, row.gate, `row ${row.id}: the display gate code matches the declared gate (${dv})`);
    }
    gateRows += 1;
  }

  // Expected verdict keys == server-derived required checks; every verdict legal.
  const requiredKeys = fidelityCheckKeys(row.source as any).slice().sort();
  eq(Object.keys(row.expected).slice().sort(), requiredKeys, `row ${row.id}: expected keys == server-derived required checks`);
  let anyChange = false;
  for (const [k, v] of Object.entries(row.expected)) {
    ok(v === "preserves" || v === "changes" || v === "uncertain", `row ${row.id}: verdict for ${k} is a legal enum`);
    if (v !== "preserves") anyChange = true;
  }
  if (row.label === "positive") ok(!anyChange, `row ${row.id}: a positive row has every verdict preserves`);
  else ok(anyChange, `row ${row.id}: a negative row has ≥1 non-preserves verdict`);

  // EVERY SEMANTIC row (positive OR negative) builds a within-cap comparison input (D01-A #1).
  if (row.kind === "semantic" && asm.ok) {
    const components = fidelityComponentsFromWire(wire);
    const providerInput = buildFidelityProviderInput(buildFidelityInput(row.source as any, asm.copy, components, row.question, landing));
    ok(measureDiceTokenLimit(providerInput, CHECKER_INPUT_CAP).within_limit, `row ${row.id}: the checker comparison input is within CHECKER_INPUT_CAP`);
  }

  // Cartesian bookkeeping over SEMANTIC rows only.
  if (row.kind === "semantic") {
    const key = `${row.mode}/${row.language}`;
    const c = cell.get(key) ?? { pos: 0, neg: 0 };
    if (row.label === "positive") { c.pos += 1; semanticPos += 1; } else { c.neg += 1; semanticNeg += 1; }
    cell.set(key, c);
  }
}

// Full Cartesian coverage: each mode × language has a semantic positive AND a semantic negative.
for (const m of DICE_V05_MODES) for (const lang of ["en", "zh-Hant"] as const) {
  const c = cell.get(`${m}/${lang}`) ?? { pos: 0, neg: 0 };
  ok(c.pos >= 1, `Cartesian coverage: ${m}/${lang} has a semantic FAITHFUL positive (${c.pos})`);
  ok(c.neg >= 1, `Cartesian coverage: ${m}/${lang} has a semantic MEANING-CHANGING negative (${c.neg})`);
}
// The named defect categories are represented (semantic + structural-gate), including the D01-D additions.
for (const cat of ["faithful", "level1_reversal", "answer_reversal", "invented_date", "pace_meaning_change", "clue_meaning_change", "caution_inverted", "averaged_factors", "omitted_difficult_factor", "unrelated_followup", "prompt_injection_in_copy", "faithful_synonym_caution", "factor_reversal", "followup_swapped_intent", "pace_reversal_immediacy", "unsupported_place", "search_order"]) {
  ok(categories.has(cat), `the eval set includes the '${cat}' category`);
}

const nCells = DICE_V05_MODES.length * 2;
console.log(`dice-v0-5 copy-fidelity eval-set (lumis_dice_fidelity_eval_v1) fixtures passed: ${rows.length} rows (${semanticPos} semantic-positive / ${semanticNeg} semantic-negative / ${gateRows} structural-gate) covering all ${nCells} mode×language cells with faithful + meaning-changing examples; categories=${[...categories].sort().join(",")}`);
