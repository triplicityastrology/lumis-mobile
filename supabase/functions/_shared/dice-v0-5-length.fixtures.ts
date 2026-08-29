/** v5 Length fixtures (§20.6) — per-mode/language field caps at the boundary
 * (exactly at cap accepts; one code point over rejects) + array-count caps +
 * complete-input structure. Character caps only; token caps live in the tokenizer fixture. */
import { parseDiceV05Stage2, CAPS, DICE_V05_BLOCK, buildProviderInput } from "./dice-v0-5-interpretation-contract.ts";
import { buildJudgmentEnvelope } from "./dice-v0-5-presentation.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
const A = (n: number, zh: boolean) => (zh ? "字" : "a").repeat(n);
const isOk = (r: any) => r?.kind === "ok";

for (const lang of ["en", "zh-Hant"] as const) {
  const zh = lang === "zh-Hant";
  const jc = CAPS.judgment[lang];
  const jg = (syn: number) => ({ status: "ok", planet_prose: A(1, zh), house_prose: A(1, zh), synthesis: A(syn, zh), watch_out: A(1, zh), suggested_followups: [A(1, zh)] });
  ok(isOk(parseDiceV05Stage2("judgment", lang, JSON.stringify(jg(jc.syn)))), `judgment/${lang} synthesis at cap accepts`);
  ok(parseDiceV05Stage2("judgment", lang, JSON.stringify(jg(jc.syn + 1))) === null, `judgment/${lang} synthesis cap+1 rejects`);
  // planet_prose cap boundary.
  ok(isOk(parseDiceV05Stage2("judgment", lang, JSON.stringify({ ...jg(1), planet_prose: A(jc.planet, zh) }))), `judgment/${lang} planet_prose at cap`);
  ok(parseDiceV05Stage2("judgment", lang, JSON.stringify({ ...jg(1), planet_prose: A(jc.planet + 1, zh) })) === null, `judgment/${lang} planet_prose cap+1`);
  // followups: 3 accepted, 4 rejected; each followup cap boundary.
  ok(isOk(parseDiceV05Stage2("judgment", lang, JSON.stringify({ ...jg(1), suggested_followups: [A(1, zh), A(1, zh), A(1, zh)] }))), `judgment/${lang} 3 followups`);
  ok(parseDiceV05Stage2("judgment", lang, JSON.stringify({ ...jg(1), suggested_followups: [A(1, zh), A(1, zh), A(1, zh), A(1, zh)] })) === null, `judgment/${lang} 4 followups rejected`);
  ok(parseDiceV05Stage2("judgment", lang, JSON.stringify({ ...jg(1), suggested_followups: [A(jc.follow + 1, zh)] })) === null, `judgment/${lang} followup cap+1`);

  const tc = CAPS.timing[lang];
  const tm = (syn: number) => ({ status: "ok", timing_summary: A(1, zh), synthesis: A(syn, zh), watch_out: null });
  ok(isOk(parseDiceV05Stage2("timing", lang, JSON.stringify(tm(tc.syn)))), `timing/${lang} synthesis at cap`);
  ok(parseDiceV05Stage2("timing", lang, JSON.stringify(tm(tc.syn + 1))) === null, `timing/${lang} synthesis cap+1`);
  ok(parseDiceV05Stage2("timing", lang, JSON.stringify({ ...tm(1), watch_out: A(tc.watch + 1, zh) })) === null, `timing/${lang} watch cap+1`);

  const vc = CAPS.level1[lang];
  const lv = (syn: number) => ({ status: "ok", synthesis: A(syn, zh), watch_out: A(1, zh), practical_step: A(1, zh) });
  ok(isOk(parseDiceV05Stage2("level1", lang, JSON.stringify(lv(vc.syn)))), `level1/${lang} synthesis at cap`);
  ok(parseDiceV05Stage2("level1", lang, JSON.stringify(lv(vc.syn + 1))) === null, `level1/${lang} synthesis cap+1`);

  const lc = CAPS.location[lang];
  const loc = (place: number) => ({ status: "ok", most_likely_area: A(1, zh), synthesis: A(1, zh),
    location_candidates: [{ rank: 1, place: A(place, zh), evidence: { p: ["p1"], h: [], e: [] } }, { rank: 2, place: A(1, zh), evidence: { p: ["p2"], h: [], e: [] } }],
    extension: null, search_order: [1, 2], watch_out: A(1, zh), practical_step: A(1, zh) });
  ok(isOk(parseDiceV05Stage2("location", lang, JSON.stringify(loc(lc.place)))), `location/${lang} place at cap`);
  ok(parseDiceV05Stage2("location", lang, JSON.stringify(loc(lc.place + 1))) === null, `location/${lang} place cap+1`);
}

// Complete provider input = block verbatim + "\nINPUT_JSON:\n" + compact JSON.
const env = buildJudgmentEnvelope("en", "Should I take the job?", "jupiter", "sagittarius", 1);
const input = buildProviderInput(DICE_V05_BLOCK.judgment, env);
ok(input.startsWith(DICE_V05_BLOCK.judgment), "input begins with the verbatim block");
ok(input.includes("\nINPUT_JSON:\n"), "input carries the delimiter");
ok(input.endsWith(JSON.stringify(env)), "input ends with the compact envelope JSON");
ok(!input.includes("\n\n"), "block+envelope has no accidental blank line");

console.log("dice-v0-5 length fixtures passed");
