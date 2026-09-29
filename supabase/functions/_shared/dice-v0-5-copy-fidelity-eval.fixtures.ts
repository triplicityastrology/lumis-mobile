/** lumis_dice_fidelity_eval_v1 — structural + self-consistency validation of the FIXED evaluation set
 * (review B07). These checks prove the artifact is well-formed and internally consistent; they do NOT
 * run a live model and therefore make NO claim about real semantic-detection accuracy (that is the
 * deferred, separately-authorised comparison). What is asserted here:
 *  - every row's `source` is a schema-VALID final interpretation;
 *  - `expected` keys are EXACTLY the server-derived required checks for that row's mode (so the ground
 *    truth cannot silently drift from the real coverage);
 *  - every verdict is a legal enum value;
 *  - `label` is consistent with the verdicts (positive ⟺ all "preserves"; negative ⟺ ≥1 change/uncertain);
 *  - the set covers all SIX modes, BOTH languages, and carries known positives AND negatives across the
 *    documented defect classes; ids are unique and stably prefixed.
 */
import { DICE_V05_FIDELITY_EVAL_V1, DICE_V05_FIDELITY_EVAL_SCHEMA } from "./dice-v0-5-copy-fidelity-eval-v1.ts";
import { fidelityCheckKeys } from "./dice-v0-5-copy-fidelity.ts";
import { validateDiceV05FinalResult, DICE_V05_MODES } from "./dice-v0-5-interpretation-contract.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

const rows = DICE_V05_FIDELITY_EVAL_V1;
ok(DICE_V05_FIDELITY_EVAL_SCHEMA === "lumis_dice_fidelity_eval_v1", "eval schema id");
ok(rows.length >= 12, `the fixed eval set has enough rows (${rows.length})`);

const seenIds = new Set<string>();
const modesSeen = new Set<string>();
const langsSeen = new Set<string>();
let positives = 0, negatives = 0;
const categories = new Set<string>();

for (const row of rows) {
  ok(/^FID-EVAL-V1-[A-Z]+-\d{3}$/.test(row.id), `row id is stably prefixed: ${row.id}`);
  ok(!seenIds.has(row.id), `row id is unique: ${row.id}`);
  seenIds.add(row.id);
  ok((DICE_V05_MODES as readonly string[]).includes(row.mode), `row ${row.id} names a real mode`);
  ok(row.language === "en" || row.language === "zh-Hant", `row ${row.id} names a supported language`);
  // The source must be a genuinely valid final interpretation (not a hand-waved stub), AND its declared
  // mode/language must match the row.
  eq(validateDiceV05FinalResult(row.source as any), "OK", `row ${row.id}: source is a schema-valid final interpretation`);
  eq((row.source as any).question_mode, row.mode, `row ${row.id}: source mode matches the row mode`);
  eq((row.source as any).language, row.language, `row ${row.id}: source language matches the row language`);
  // Expected verdict keys are EXACTLY the server-derived required checks — the ground truth cannot drift.
  const requiredKeys = fidelityCheckKeys(row.source as any).slice().sort();
  eq(Object.keys(row.expected).slice().sort(), requiredKeys, `row ${row.id}: expected keys == the server-derived required checks`);
  let anyChange = false;
  for (const [k, v] of Object.entries(row.expected)) {
    ok(v === "preserves" || v === "changes" || v === "uncertain", `row ${row.id}: verdict for ${k} is a legal enum value`);
    if (v !== "preserves") anyChange = true;
  }
  // label ⇔ verdicts.
  if (row.label === "positive") { ok(!anyChange, `row ${row.id}: a positive row has every verdict "preserves"`); positives += 1; }
  else { ok(anyChange, `row ${row.id}: a negative row has at least one non-"preserves" verdict`); negatives += 1; }
  // proposed carries the compared component prose.
  ok(row.proposed && typeof row.proposed === "object" && Object.keys(row.proposed).length > 0, `row ${row.id}: carries proposed components`);
  ok(typeof row.rationale === "string" && row.rationale.length > 10, `row ${row.id}: carries a rationale`);
  modesSeen.add(row.mode); langsSeen.add(row.language); categories.add(row.category);
}

// Coverage: all six modes, both languages, and both labels present.
for (const m of DICE_V05_MODES) ok(modesSeen.has(m), `the eval set covers mode ${m}`);
ok(langsSeen.has("en") && langsSeen.has("zh-Hant"), "the eval set covers EN and HK-Traditional");
ok(positives >= 4 && negatives >= 6, `the eval set carries both faithful positives (${positives}) and meaning-changing negatives (${negatives})`);
// The known defect classes the handoff §12 names are represented.
for (const c of ["factor_reversal", "averaged_factors", "pace_reversal_immediacy", "invented_date", "unsupported_place", "search_order", "careful_to_reckless_reversal", "caution_inverted", "followup_swapped_intent", "prompt_injection_in_copy"]) {
  ok(categories.has(c), `the eval set includes the '${c}' defect class`);
}

console.log(`dice-v0-5 copy-fidelity eval-set (lumis_dice_fidelity_eval_v1) fixtures passed: ${rows.length} rows, ${positives} positive / ${negatives} negative, modes=${[...modesSeen].sort().join(",")}, languages=${[...langsSeen].sort().join(",")}`);
