/**
 * §20.1 classification acceptance fixtures (EN / written Chinese / Cantonese-style
 * / mixed). Mode selection is the AI's job at runtime, so these deterministically
 * verify the pipeline around it: the hard gate rejects bundled cases before any
 * provider call, language is detected from the question, and the two-stage flow
 * routes whatever mode the router returns to a completed reading. Each row's
 * required mode is documented and exercised via a scripted Stage-1 selection.
 */
import { executeDiceV04FreeTextCase, type DiceV04FreeTextRequest } from "./dice-v0-4-window.ts";
import type { DiceV04InvokeInput, DiceV04ProviderAdapter, DiceV04ProviderResult } from "./azure-dice-adapter-v4.ts";
import { DICE_V04_RESULT_SCHEMA, type DiceV04QuestionMode } from "./dice-v0-4-interpretation-contract.ts";

function ok(v: unknown, label: string): asserts v { if (!v) throw new Error("FAIL: " + label); }
function eq(a: unknown, b: unknown, label: string): void { if (a !== b) throw new Error(`FAIL: ${label} (got ${JSON.stringify(a)})`); }
const now = () => 1_000_000;
const landing = { planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" };

// A valid Stage-2 result for a given mode + language (passes parseDiceV04Output).
function validResult(mode: DiceV04QuestionMode, language: "en" | "zh-Hant") {
  const en = language === "en";
  const base = {
    schema: DICE_V04_RESULT_SCHEMA, status: "completed", language, question_mode: mode,
    planet_layer: null, sign_layer: null, house_layer: null,
    synthesis: en ? "This reading holds together as one clear thread. The parts support a single, workable direction." : "這個解讀綜合成一個清晰方向。各部分支持同一個可行的做法。",
    judgment_code: null as string | null, judgment_summary: null as string | null, timing_summary: null as string | null,
    watch_out: en ? "One real risk here is moving faster than the situation can actually support." : "一個實在的風險，是比情況實際能承受的走得更快。",
    practical_step: (en ? "Take one concrete, reversible action that fits this exact situation and review it." : "採取一個具體、可回頭而切合此情況的行動，並檢視結果。") as string | null,
    suggested_followups: [] as string[],
  };
  if (mode === "judgment") {
    base.judgment_code = "favourable";
    base.judgment_summary = en ? "A qualified, favourable read that still depends on the conditions holding." : "屬有條件的有利判斷，仍取決於條件是否維持。";
    base.practical_step = null;
    base.suggested_followups = [en ? "What should I prepare first?" : "我最需要先準備甚麼？"];
  } else if (mode === "timing") {
    base.timing_summary = en ? "The overall pace is moderate, gradual in the natural scale of this matter." : "整體步調中等，在此事的自然尺度上屬逐步推進。";
  }
  return base;
}

function scripted(mode: DiceV04QuestionMode | null, language: "en" | "zh-Hant"): DiceV04ProviderAdapter {
  let i = 0;
  return Object.freeze({
    async invoke(_input: DiceV04InvokeInput): Promise<DiceV04ProviderResult> {
      const content = i === 0 ? JSON.stringify({ selection: mode }) : JSON.stringify(validResult(mode as DiceV04QuestionMode, language));
      i += 1;
      return { kind: "success", content };
    },
  });
}
const rejectingAdapter: DiceV04ProviderAdapter = Object.freeze({ async invoke(): Promise<DiceV04ProviderResult> { throw new Error("provider must not be called for a hard-gated question"); } });

type Row = { q: string; language: "en" | "zh-Hant"; expect: DiceV04QuestionMode | "bundled" };
const ROWS: Row[] = [
  { q: "How is my current job condition?", language: "en", expect: "thing_or_situation" },
  { q: "How will this job opportunity turn out?", language: "en", expect: "judgment" },
  { q: "How long will approval take?", language: "en", expect: "timing" },
  { q: "Should I accept this job?", language: "en", expect: "judgment" },
  { q: "What kind of job should I seek?", language: "en", expect: "thing_or_situation" },
  { q: "Why does this keep happening?", language: "en", expect: "reason" },
  { q: "What kind of person is my new manager?", language: "en", expect: "person" },
  { q: "Where is my missing ring?", language: "en", expect: "location" },
  { q: "Will I find my missing ring?", language: "en", expect: "judgment" },
  { q: "Will I find my ring, and where is it?", language: "en", expect: "bundled" },
  { q: "我份工而家情況點？", language: "zh-Hant", expect: "thing_or_situation" },
  { q: "呢個機會最後會點樣發展？", language: "zh-Hant", expect: "judgment" },
  { q: "我應唔應該去 Working Holiday？", language: "zh-Hant", expect: "judgment" },
  { q: "我應該搵咩工作？", language: "zh-Hant", expect: "thing_or_situation" },
  { q: "我個 application 幾時會批？", language: "zh-Hant", expect: "timing" },
  { q: "我個 application 會唔會批？幾時會批？", language: "zh-Hant", expect: "bundled" },
  { q: "我嚟緊個新上司係一個咩人？", language: "zh-Hant", expect: "person" },
  { q: "我隻戒指可能喺邊？", language: "zh-Hant", expect: "location" },
];

let checked = 0;
for (const row of ROWS) {
  const req: DiceV04FreeTextRequest = { question: row.q, ...landing };
  if (row.expect === "bundled") {
    const out = await executeDiceV04FreeTextCase(req, rejectingAdapter, now);
    ok(out.kind === "bundled" || out.kind === "route_review", `hard-gate rejects: ${row.q}`);
    eq(out.provider_calls, 0, `no provider call for bundled: ${row.q}`);
    eq(out.language, row.language, `bundled language: ${row.q}`);
  } else {
    const out = await executeDiceV04FreeTextCase(req, scripted(row.expect, row.language), now);
    eq(out.kind, "completed", `pipeline completes: ${row.q}`);
    if (out.kind === "completed") {
      eq(out.question_mode, row.expect, `routed mode: ${row.q}`);
      eq(out.result.language, row.language, `language: ${row.q}`);
      eq(out.provider_calls, 2, `two-stage provider calls: ${row.q}`);
    }
  }
  checked += 1;
}
eq(checked, 18, "all §20.1 rows exercised");
console.log(`Dice v4 §20.1 classification fixtures passed: ${checked} rows (EN + written Chinese + Cantonese-style + mixed), hard-gate + language + two-stage routing.`);
